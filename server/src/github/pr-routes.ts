import {Hono} from 'hono'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {githubRepo, git, agentSummarizePullRequest, isInlineTaskError} from 'core'
import {createPR, findOpenPR, getPullRequest, listPullRequests} from './pr'
import {projectsRepo, attempts, tasks} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'

const createPrSchema = z.object({
    base: z.string().min(1).optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    draft: z.boolean().optional(),
    branch: z.string().optional(),
    attemptId: z.string().optional(),
    cardId: z.string().optional(),
})

const listPrQuerySchema = z.object({
    branch: z.string().optional(),
    state: z.enum(['open', 'closed', 'all']).optional(),
})

const createPrSummarySchema = z.object({
    base: z.string().min(1).optional(),
    branch: z.string().min(1).optional(),
    agent: z.string().optional(),
    profileId: z.string().optional(),
})

export function createGithubProjectRouter() {
    const router = new Hono<AppEnv>()

    const authRequired = (c: any, action: string) => problemJson(c, {
        status: 401,
        title: 'GitHub authentication required',
        detail: `Connect GitHub before ${action}`,
    })

    // GET /projects/:projectId/pull-requests?branch=
    router.get('/:projectId/pull-requests', zValidator('query', listPrQuerySchema), async (c) => {
        const {branch, state} = c.req.valid('query')
        const projectId = c.req.param('projectId')
        try {
            const auth = await githubRepo.getGithubConnection()
            if (!auth?.accessToken) return authRequired(c, 'listing pull requests')
            const pullRequests = await listPullRequests(projectId, auth.accessToken, {
                state: state ?? 'open',
                branch: branch?.trim() || undefined,
            })
            return c.json({pullRequests}, 200)
        } catch (error) {
            log.error('github:pull-requests:list', 'failed', {err: error, projectId, branch, state})
            const message = error instanceof Error ? error.message : 'Failed to list pull requests'
            const lowered = message.toLowerCase()
            const status: 401 | 502 = lowered.includes('auth') || lowered.includes('credential') || lowered.includes('401') ? 401 : 502
            return problemJson(c, {status, detail: message})
        }
    })

    // POST /projects/:projectId/pull-requests/summary
    router.post(
        '/:projectId/pull-requests/summary',
        zValidator('json', createPrSummarySchema),
        async (c) => {
            const {base, branch, agent, profileId} = c.req.valid('json')
            const projectId = c.req.param('projectId')

            const trimmedBranch = branch?.trim() || ''
            let headBranch = trimmedBranch

            try {
                if (!headBranch) {
                    const status = await git.getStatus(projectId)
                    headBranch = status.branch?.trim() || ''
                }

                if (!headBranch) {
                    return problemJson(c, {
                        status: 409,
                        detail: 'Branch name missing for PR summary',
                    })
                }

                const baseBranch = base?.trim() || undefined

                const summary = await agentSummarizePullRequest({
                    projectId,
                    baseBranch,
                    headBranch,
                    agentKey: agent,
                    profileId,
                    signal: c.req.raw.signal,
                })

                return c.json({summary}, 200)
            } catch (error) {
                if (isInlineTaskError(error)) {
                    const code = error.code
                    if (code === 'UNKNOWN_AGENT' || code === 'AGENT_NO_INLINE') {
                        return problemJson(c, {status: 400, detail: error.message})
                    }
                    if (code === 'ABORTED') {
                        return problemJson(c, {
                            status: 499,
                            detail: 'Pull request summary cancelled',
                        })
                    }
                    log.error(
                        'github:pull-requests:summary',
                        'inline task failed',
                        {err: error, projectId, base, branch, agent, profileId},
                    )
                    return problemJson(c, {
                        status: 502,
                        detail: 'Failed to summarize pull request',
                    })
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to summarize pull request'

                let status = 502
                if (message === 'Project not found') {
                    status = 404
                } else if (
                    message.startsWith('Unknown agent:') ||
                    message.includes('does not support inline task: prSummary')
                ) {
                    status = 400
                }

                if (status >= 500) {
                    log.error(
                        'github:pull-requests:summary',
                        'failed',
                        {err: error, projectId, base, branch, agent, profileId},
                    )
                }

                return problemJson(c, {
                    status,
                    detail:
                        status >= 500 ? 'Failed to summarize pull request' : message,
                })
            }
        },
    )

    // GET /projects/:projectId/pull-requests/:number
    router.get('/:projectId/pull-requests/:number', async (c) => {
        const projectId = c.req.param('projectId')
        const numRaw = c.req.param('number')
        const number = Number(numRaw)
        if (!Number.isFinite(number)) return problemJson(c, {status: 400, detail: 'PR number must be numeric'})
        try {
            const auth = await githubRepo.getGithubConnection()
            if (!auth?.accessToken) return authRequired(c, 'fetching pull requests')
            const pr = await getPullRequest(projectId, auth.accessToken, number)
            return c.json({pr}, 200)
        } catch (error) {
            log.error('github:pull-requests:get', 'failed', {err: error, projectId, number})
            const message = error instanceof Error ? error.message : 'Failed to load pull request'
            const lowered = message.toLowerCase()
            const status: 401 | 502 = lowered.includes('auth') || lowered.includes('credential') || lowered.includes('401') ? 401 : 502
            return problemJson(c, {status, detail: message})
        }
    })

    // POST /projects/:projectId/pull-requests
    router.post('/:projectId/pull-requests', zValidator('json', createPrSchema), async (c) => {
        const {base, title, body, draft, branch, attemptId, cardId} = c.req.valid('json')
        const projectId = c.req.param('projectId')
        const services = c.get('services')
        const events = c.get('events')

        try {
            const auth = await githubRepo.getGithubConnection()
            if (!auth?.accessToken) return authRequired(c, 'creating pull requests')

            // Validate attempt/card ownership to prevent cross-project mutations
            const attempt = attemptId ? await attempts.getAttempt(attemptId) : null
            if (attempt && attempt.boardId !== projectId) {
                return problemJson(c, {status: 400, detail: 'Attempt does not belong to this project'})
            }

            const card = cardId ? await projectsRepo.getCardById(cardId) : attempt?.cardId ? await projectsRepo.getCardById(attempt.cardId) : null
            let cardBoardId: string | null = null
            if (card) {
                cardBoardId = card.boardId ?? null
                if (!cardBoardId) {
                    const column = await projectsRepo.getColumnById(card.columnId)
                    cardBoardId = column?.boardId ?? null
                }
                if (cardBoardId && cardBoardId !== projectId) {
                    return problemJson(c, {status: 400, detail: 'Card does not belong to this project'})
                }
            }

            const settings = await services.projects.ensureSettings(projectId)
            const remote = settings.preferredRemote?.trim() || 'origin'
            const status = await git.getStatus(projectId)
            const head = (branch ?? status.branch).trim()
            if (!head) return problemJson(c, {status: 409, detail: 'Branch name missing'})
            const baseBranch = (base ?? settings.baseBranch ?? 'main').trim()

            // Ensure branch exists remotely to avoid GitHub 422 errors
            if (attempt?.worktreePath) {
                await git.pushAtPath(
                    attempt.worktreePath,
                    {remote, branch: head, token: auth.accessToken, setUpstream: true},
                    {projectId, attemptId: attempt.id},
                )
            } else {
                await git.push(projectId, {remote, branch: head, token: auth.accessToken, setUpstream: true})
                const ts = new Date().toISOString()
                events.publish('git.push.completed', {projectId, attemptId, remote, branch: head, ts})
                events.publish('git.status.changed', {projectId})
            }

            const existing = await findOpenPR(projectId, auth.accessToken, head).catch(() => null)
            const pr = existing ?? await createPR(projectId, auth.accessToken, {
                base: baseBranch,
                head,
                title,
                body,
                draft,
            })

            events.publish('github.pr.created', {projectId, attemptId, pr})

            // Persist PR URL on the card when available
            try {
                const targetCardId = card?.id ?? attempt?.cardId
                const boardId = cardBoardId ?? attempt?.boardId ?? projectId
                if (targetCardId && boardId) {
                    await projectsRepo.updateCard(targetCardId, {prUrl: pr.url, updatedAt: new Date()})
                    await tasks.broadcastBoard(boardId)
                }
            } catch (persistError) {
                log.error('github:pull-requests:create', 'failed to persist PR url', {
                    err: persistError,
                    projectId,
                    attemptId,
                    cardId: card?.id ?? attempt?.cardId,
                    prUrl: pr.url,
                })
            }

            return c.json({pr}, 200)
        } catch (error) {
            log.error('github:pull-requests:create', 'failed', {
                err: error,
                projectId,
                attemptId,
                branch: branch ?? undefined,
                base,
            })
            const message = error instanceof Error ? error.message : 'Failed to create PR'
            const lowered = message.toLowerCase()
            const status: 401 | 502 = lowered.includes('auth') || lowered.includes('permission') || lowered.includes('credential') || lowered.includes('401')
                ? 401
                : 502
            return problemJson(c, {status, detail: message})
        }
    })

    // Deprecated GitHub PR shim
    router.get('/:projectId/github/pr', (c) => {
        c.header('Deprecation', 'true')
        c.header('Link', '</api/v1/projects/{projectId}/pull-requests>; rel="successor-version"')
        return problemJson(c, {status: 410, detail: 'Moved to /projects/:projectId/pull-requests'})
    })

    router.post('/:projectId/github/pr', (c) => {
        c.header('Deprecation', 'true')
        c.header('Link', '</api/v1/projects/{projectId}/pull-requests>; rel="successor-version"')
        return problemJson(c, {status: 410, detail: 'Moved to /projects/:projectId/pull-requests'})
    })

    return router
}
