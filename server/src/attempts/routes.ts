import {Hono} from 'hono'
import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {projectsRepo, projectDeps, attempts, git, type FileSource, githubRepo, settingsService, tasks} from 'core'
import {openEditorAtPath} from '../editor/service'
import {createPR, findOpenPR} from '../github/pr'
import {problemJson} from '../http/problem'
import {log} from '../log'

const {
    getFileContentAtPath,
    getStatusAgainstBaseAtPath,
    resolveBaseAncestorAtPath,
    resolveBaseRefAtPath,
    commitAtPath,
    pushAtPath,
    mergeBranchIntoBaseForProject,
} = git

const {getGithubConnection} = githubRepo

const stopSchema = z.object({
    status: z.enum(['stopped']),
})

const messageSchema = z.object({
    prompt: z.string().min(1),
    profileId: z.string().optional(),
})

export const createAttemptsRouter = () => {
    const router = new Hono<AppEnv>()

    // Deprecated start path kept only to signal new canonical route
    router.post('/boards/:boardId/cards/:cardId/attempts', async (c) => {
        c.header('Deprecation', 'true')
        c.header('Link', '</api/v1/projects/{projectId}/cards/{cardId}/attempts>; rel="successor-version"')
        return problemJson(c, {status: 410, detail: 'Moved to /projects/:projectId/cards/:cardId/attempts'})
    })

    router.get('/:id', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        return c.json(attempt)
    })

    router.patch('/:id', zValidator('json', stopSchema), async (c) => {
        const {status} = c.req.valid('json')
        if (status !== 'stopped') return problemJson(c, {status: 400, detail: 'Only status=stopped is supported'})

        const events = c.get('events')
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})

        const ok = await attempts.stopAttempt(c.req.param('id'), {events})
        if (!ok) return problemJson(c, {status: 409, detail: 'Attempt is not running'})
        const updated = await attempts.getAttempt(c.req.param('id'))
        return c.json({attempt: updated ?? null, status: updated?.status ?? 'stopped'})
    })

    // Keep old stop path as a deprecation hint
    router.post('/:id/stop', async (c) => {
        c.header('Deprecation', 'true')
        const id = c.req.param('id')
        c.header('Link', `</api/v1/attempts/${id}>; rel="successor-version"`)
        return problemJson(c, {status: 410, detail: 'Use PATCH /attempts/:id with status=stopped'})
    })

    router.get('/:id/logs', async (c) => {
        const rows = await attempts.listAttemptLogs(c.req.param('id'))
        return c.json({logs: rows})
    })

    // Open editor at worktree (or subpath)
    router.post('/:id/open-editor', zValidator('json', z.object({
        subpath: z.string().optional(),
        editorKey: z.string().optional(),
    })), async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        const body = c.req.valid('json')
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        const path = body?.subpath ? `${attempt.worktreePath}/${body.subpath}` : attempt.worktreePath
        const events = c.get('events')
        const settings = settingsService.snapshot()
        let attemptedEditorKey: string | undefined = body?.editorKey ?? settings.editorType
        events.publish('editor.open.requested', {
            path,
            editorKey: attemptedEditorKey,
            attemptId: attempt.id,
            projectId: attempt.boardId,
        })

        try {
            const {spec, env} = await openEditorAtPath(path, {
                editorKey: body.editorKey as any,
            })
            attemptedEditorKey = env.EDITOR_KEY ?? attemptedEditorKey
            events.publish('editor.open.succeeded', {
                path,
                editorKey: attemptedEditorKey ?? 'VS_CODE',
                pid: undefined,
            })
            // diagnostics to help user debug when editor doesn't open
            const envPath = env.PATH ?? process.env.PATH ?? ''
            const which = (name: string) => (Bun as any)?.which?.(name) ?? null
            const found = {
                code: which('code'),
                codeInsiders: which('code-insiders'),
                zed: which('zed'),
                webstorm: which('webstorm'),
            }
            const envDiag = {
                DISPLAY: env.DISPLAY ?? null,
                WAYLAND_DISPLAY: env.WAYLAND_DISPLAY ?? null,
                XDG_RUNTIME_DIR: env.XDG_RUNTIME_DIR ?? null,
                DBUS_SESSION_BUS_ADDRESS: env.DBUS_SESSION_BUS_ADDRESS ?? null,
            }
            return c.json({ok: true, command: spec, envPath, env: envDiag, editorEnv: env, found})
        } catch (error) {
            events.publish('editor.open.failed', {
                path,
                editorKey: attemptedEditorKey ?? 'VS_CODE',
                error: error instanceof Error ? error.message : String(error),
            })
            log.error({err: error, attemptId: attempt.id, boardId: attempt.boardId}, '[attempts:open-editor] failed')
            return problemJson(c, {status: 500, detail: 'Failed to open editor'})
        }
    })

    // Git endpoints per attempt (use worktree path)
    router.get('/:id/git/status', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        try {
            const {projects} = c.get('services')
            const settings = await projects.ensureSettings(attempt.boardId)
            const remote = settings.preferredRemote?.trim() || undefined
            const baseAncestor = await resolveBaseAncestorAtPath(attempt.worktreePath, attempt.baseBranch || undefined, remote)
            const status = await getStatusAgainstBaseAtPath(attempt.worktreePath, baseAncestor)
            return c.json(status, 200)
        } catch (error) {
            log.error({err: error, attemptId: attempt.id, boardId: attempt.boardId}, '[attempts:git:status] failed')
            return problemJson(c, {status: 502, detail: 'Failed to get git status'})
        }
    })

    router.get('/:id/git/file', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        const path = c.req.query('path') || ''
        if (!path) return problemJson(c, {status: 400, detail: 'Missing path'})
        const source = (c.req.query('source') || 'worktree') as FileSource
        try {
            let ref: string | undefined = undefined
            if (source === 'base') {
                const {projects} = c.get('services')
                const settings = await projects.ensureSettings(attempt.boardId)
                const remote = settings.preferredRemote?.trim() || undefined
                ref = await resolveBaseAncestorAtPath(attempt.worktreePath, attempt.baseBranch || undefined, remote)
            }
            const content = await getFileContentAtPath(attempt.worktreePath, path, source, ref)
            return c.json({content}, 200)
        } catch (error) {
            log.error(
                {err: error, attemptId: attempt.id, boardId: attempt.boardId, path, source},
                '[attempts:git:file] failed',
            )
            return problemJson(c, {status: 502, detail: 'Failed to fetch file content'})
        }
    })

    router.post('/:id/messages', zValidator('json', messageSchema), async (c) => {
        const {prompt, profileId} = c.req.valid('json')
        try {
            const attempt = await attempts.getAttempt(c.req.param('id'))
            if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
            const {getCardById, getColumnById} = projectsRepo
            const card = await getCardById(attempt.cardId)
            if (card) {
                const column = await getColumnById(card.columnId)
                const title = (column?.title || '').trim().toLowerCase()
                if (title === 'done') return problemJson(c, {status: 409, detail: 'Task is done and locked'})
            }
            try {
                const {blocked} = await projectDeps.isCardBlocked(attempt.cardId)
                if (blocked) return problemJson(c, {status: 409, detail: 'Task is blocked by dependencies'})
            } catch {
            }

            const events = c.get('events')
            await attempts.followupAttempt(c.req.param('id'), prompt, profileId, {events})
            return c.json({ok: true}, 201)
        } catch (err) {
            return problemJson(c, {
                status: 422,
                detail: err instanceof Error ? err.message : 'Follow-up failed'
            })
        }
    })

    // Deprecated follow-up path
    router.post('/:id/followup', async (c) => {
        c.header('Deprecation', 'true')
        c.header('Link', '</api/v1/attempts/{id}/messages>; rel="successor-version"')
        return problemJson(c, {status: 410, detail: 'Use POST /attempts/:id/messages'})
    })

    // ---- Attempt-scoped Git write operations ----
    router.post('/:id/git/commit', zValidator('json', z.object({
        subject: z.string().min(1),
        body: z.string().optional()
    })), async (c) => {
        const {subject, body} = c.req.valid('json')
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        try {
            const shortSha = await commitAtPath(attempt.worktreePath, subject, body, {
                projectId: attempt.boardId,
                attemptId: attempt.id,
            })
            return c.json({shortSha}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Commit failed'
            return problemJson(c, {status: 422, detail: message})
        }
    })

    router.post('/:id/git/push', zValidator('json', z.object({setUpstream: z.boolean().optional()})), async (c) => {
        const {setUpstream} = c.req.valid('json')
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        const {projects} = c.get('services')
        const settings = await projects.ensureSettings(attempt.boardId)
        const remote = settings.preferredRemote?.trim() || 'origin'
        const auth = await getGithubConnection().catch(() => null)
        try {
            await pushAtPath(
                attempt.worktreePath,
                {remote, branch: attempt.branchName, token: auth?.accessToken || undefined, setUpstream},
                {projectId: attempt.boardId, attemptId: attempt.id},
            )
            return c.json({remote, branch: attempt.branchName}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Push failed'
            const status: ContentfulStatusCode = message.toLowerCase().includes('auth') || message.toLowerCase().includes('permission') ? 401 : 502
            return problemJson(c, {status, detail: message})
        }
    })

    router.post('/:id/github/pr', zValidator('json', z.object({
        base: z.string().optional(),
        title: z.string().min(1),
        body: z.string().optional(),
        draft: z.boolean().optional()
    })), async (c) => {
        const {base, title, body, draft} = c.req.valid('json')
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
        const auth = await getGithubConnection().catch(() => null)
        if (!auth) return problemJson(c, {status: 401, title: 'GitHub authentication required', detail: 'Connect GitHub before creating pull requests'})
        try {
            const {projects} = c.get('services')
            const settings = await projects.ensureSettings(attempt.boardId)
            const head = attempt.branchName?.trim()
            if (!head) return problemJson(c, {status: 409, detail: 'Branch name missing'})
            const baseBranch = (base || settings.baseBranch || 'main').trim()
            const remote = settings.preferredRemote?.trim() || 'origin'
            // Reuse open PR if exists
            const token = auth.accessToken || ''
            // Ensure the branch exists on the remote before creating the PR to avoid GitHub "head invalid" errors
            await pushAtPath(
                attempt.worktreePath,
                {remote, branch: head, token: token || undefined, setUpstream: true},
                {projectId: attempt.boardId, attemptId: attempt.id},
            )
            const existing = await findOpenPR(attempt.boardId, token, head).catch(() => null)
            const pr = existing ?? await createPR(attempt.boardId, token, {base: baseBranch, head, title, body, draft})
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
                log.error(
                    {err: error, attemptId: attempt.id, cardId: attempt.cardId, prUrl: pr.url},
                    '[attempts:pr] failed to persist PR url',
                )
            }
            return c.json({pr}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'PR failed'
            const status: ContentfulStatusCode = message.toLowerCase().includes('auth') ? 401 : 502
            return problemJson(c, {status, detail: message})
        }
    })

    // Merge attempt branch into base branch (no push)
    router.post('/:id/git/merge', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        const {projects} = c.get('services')
        const settings = await projects.ensureSettings(attempt.boardId)
        const remote = settings.preferredRemote?.trim() || 'origin'
        const events = c.get('events')
        try {
            const baseBranch = attempt.baseBranch || 'main'
            const headBranch = attempt.branchName
            await mergeBranchIntoBaseForProject(attempt.boardId, {remote, baseBranch, headBranch})
            const ts = new Date().toISOString()
            const message = `[git] merged ${headBranch} into ${baseBranch}`
            events.publish('attempt.log.appended', {
                attemptId: attempt.id,
                boardId: attempt.boardId,
                level: 'info',
                message,
                ts,
            })
            events.publish('git.merge.completed', {
                projectId: attempt.boardId,
                attemptId: attempt.id,
                result: {merged: true, message},
            })
            events.publish('git.status.changed', {projectId: attempt.boardId})
            // Move card to Done; filesystem listener will handle cleanup when enabled
            try {
                const {moveCardToColumnByTitle} = await import('../tasks/service')
                await moveCardToColumnByTitle(attempt.boardId, attempt.cardId, 'Done')
            } catch {
            }
            return c.json({ok: true, base: baseBranch}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Merge failed'
            const status: ContentfulStatusCode = message.toLowerCase().includes('conflict') ? 409 : 502
            return problemJson(c, {status, detail: message})
        }
    })

    router.post('/:id/automation/dev', async (c) => {
        const events = c.get('events')
        try {
            const item = await attempts.runAttemptAutomation(c.req.param('id'), 'dev', {events})
            return c.json({item})
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to run dev automation'
            let status: ContentfulStatusCode = 500
            if (message === 'Attempt not found') status = 404
            else if (message.startsWith('No automation script configured')) status = 422
            else if (message.includes('Worktree is missing')) status = 409
            if (status >= 500) {
                log.error({err: error, attemptId: c.req.param('id')}, '[attempts:automation:dev] failed')
            }
            return problemJson(c, {status, detail: message})
        }
    })

    return router
}
