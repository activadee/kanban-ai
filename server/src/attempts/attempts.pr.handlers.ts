import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {attempts, githubRepo, projectsRepo, tasks, git} from 'core'
import {createPR, findOpenPR} from '../github/pr'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'
import {attemptPrSchema} from './attempts.schemas'

const {pushAtPath} = git
const {getGithubConnection} = githubRepo

const attemptIdParam = z.object({id: z.string()})

export const createAttemptPrHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    zValidator('json', attemptPrSchema),
    async (c) => {
        const {id} = c.req.valid('param')
        const {base, title, body, draft} = c.req.valid('json')
        const attempt = await attempts.getAttempt(id)
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        const auth = await getGithubConnection().catch(() => null)
        if (!auth) {
            return problemJson(c, {
                status: 401,
                title: 'GitHub authentication required',
                detail: 'Connect GitHub before creating pull requests',
            })
        }
        try {
            const {projects} = c.get('services')
            const settings = await projects.ensureSettings(attempt.boardId)
            const head = attempt.branchName?.trim()
            if (!head) return problemJson(c, {status: 409, detail: 'Branch name missing'})
            const baseBranch = (base || settings.baseBranch || 'main').trim()
            const remote = settings.preferredRemote?.trim() || 'origin'
            const token = auth.accessToken || ''
            await pushAtPath(
                attempt.worktreePath,
                {remote, branch: head, token: token || undefined, setUpstream: true},
                {projectId: attempt.boardId, attemptId: attempt.id},
            )
            const existing = await findOpenPR(attempt.boardId, token, head).catch(() => null)
            const pr = existing ?? (await createPR(attempt.boardId, token, {base: baseBranch, head, title, body, draft}))
            const events = c.get('events')
            events.publish('github.pr.created', {
                projectId: attempt.boardId,
                attemptId: attempt.id,
                pr,
            })
            try {
                await projectsRepo.updateCard(attempt.cardId, {prUrl: pr.url, updatedAt: new Date()})
                await tasks.broadcastBoard(attempt.boardId)
            } catch (error) {
                log.error('attempts:pr', 'failed to persist PR url', {
                    err: error,
                    attemptId: attempt.id,
                    cardId: attempt.cardId,
                    prUrl: pr.url,
                })
            }
            return c.json({pr}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'PR failed'
            const status: ContentfulStatusCode = message.toLowerCase().includes('auth') ? 401 : 502
            return problemJson(c, {status, detail: message})
        }
    },
)
