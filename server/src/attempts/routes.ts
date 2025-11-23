import {Hono} from 'hono'
import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {projectsRepo, projectDeps, attempts, git, type FileSource, githubRepo, settingsService} from 'core'
import {openEditorAtPath} from '../editor/service'
import {createPR, findOpenPR} from '../github/pr'

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

const startSchema = z.object({
    agent: z.enum(['ECHO', 'SHELL', 'CODEX']),
    baseBranch: z.string().min(1).optional(),
    branchName: z.string().min(1).optional(),
    profileId: z.string().optional(),
})

export const createAttemptsRouter = () => {
    const router = new Hono<AppEnv>()

    // Nested start under board/card
    router.post('/boards/:boardId/cards/:cardId/attempts', zValidator('json', startSchema), async (c) => {
        const {agent, baseBranch, branchName, profileId} = c.req.valid('json')
        const events = c.get('events')
        // Disallow starting attempts if task is done or blocked
        try {
            const {getCardById, getColumnById} = projectsRepo
            const card = await getCardById(c.req.param('cardId'))
            if (card) {
                const col = await getColumnById(card.columnId)
                const title = (col?.title || '').trim().toLowerCase()
                if (title === 'done') return c.json({error: 'Task is done and locked'}, 409)
            }
        } catch {
        }
        try {
            const {blocked} = await projectDeps.isCardBlocked(c.req.param('cardId'))
            if (blocked) return c.json({error: 'Task is blocked by dependencies'}, 409)
        } catch {
        }
        const attempt = await attempts.startAttempt(
            {
                boardId: c.req.param('boardId'),
                cardId: c.req.param('cardId'),
                agent,
                baseBranch,
                branchName,
                profileId,
            },
            {events},
        )
        return c.json(attempt, 201)
    })

    router.get('/:id', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return c.json({error: 'Not found'}, 404)
        return c.json(attempt)
    })

    router.post('/:id/stop', async (c) => {
        const events = c.get('events')
        const ok = await attempts.stopAttempt(c.req.param('id'), {events})
        if (!ok) return c.json({error: 'Not running'}, 409)
        return c.json({ok: true})
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
        if (!attempt) return c.json({error: 'Not found'}, 404)
        const body = c.req.valid('json')
        if (!attempt.worktreePath) return c.json({error: 'No worktree for attempt'}, 409)
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
            console.error('[attempts:open-editor] failed', error)
            return c.json({error: 'Failed to open editor'}, 500)
        }
    })

    // Git endpoints per attempt (use worktree path)
    router.get('/:id/git/status', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return c.json({error: 'Not found'}, 404)
        if (!attempt.worktreePath) return c.json({error: 'No worktree for attempt'}, 409)
        try {
            const {projects} = c.get('services')
            const settings = await projects.ensureSettings(attempt.boardId)
            const remote = settings.preferredRemote?.trim() || undefined
            const baseAncestor = await resolveBaseAncestorAtPath(attempt.worktreePath, attempt.baseBranch || undefined, remote)
            const status = await getStatusAgainstBaseAtPath(attempt.worktreePath, baseAncestor)
            return c.json(status, 200)
        } catch (error) {
            console.error('[attempts:git:status] failed', error)
            return c.json({error: 'Failed to get git status'}, 500)
        }
    })

    router.get('/:id/git/file', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return c.json({error: 'Not found'}, 404)
        if (!attempt.worktreePath) return c.json({error: 'No worktree for attempt'}, 409)
        const path = c.req.query('path') || ''
        if (!path) return c.json({error: 'Missing path'}, 400)
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
            console.error('[attempts:git:file] failed', error)
            return c.json({error: 'Failed to fetch file content'}, 500)
        }
    })

    router.post('/:id/followup', zValidator('json', z.object({
        prompt: z.string().min(1),
        profileId: z.string().optional()
    })), async (c) => {
        const {prompt, profileId} = c.req.valid('json')
        try {
            // Disallow follow-up if card is in Done
            const attempt = await attempts.getAttempt(c.req.param('id'))
            if (!attempt) return c.json({error: 'Not found'}, 404)
            const {getCardById, getColumnById} = projectsRepo
            const card = await getCardById(attempt.cardId)
            if (card) {
                const column = await getColumnById(card.columnId)
                const title = (column?.title || '').trim().toLowerCase()
                if (title === 'done') return c.json({error: 'Task is done and locked'}, 409)
            }

            const events = c.get('events')
            const att = await attempts.followupAttempt(c.req.param('id'), prompt, profileId, {events})
            return c.json(att, 201)
        } catch (err) {
            return c.json({error: err instanceof Error ? err.message : 'Follow-up failed'}, 400)
        }
    })

    // ---- Attempt-scoped Git write operations ----
    router.post('/:id/git/commit', zValidator('json', z.object({
        subject: z.string().min(1),
        body: z.string().optional()
    })), async (c) => {
        const {subject, body} = c.req.valid('json')
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return c.json({error: 'Not found'}, 404)
        if (!attempt.worktreePath) return c.json({error: 'No worktree for attempt'}, 409)
        try {
            const shortSha = await commitAtPath(attempt.worktreePath, subject, body, {
                projectId: attempt.boardId,
                attemptId: attempt.id,
            })
            return c.json({shortSha}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Commit failed'
            return c.json({error: message}, 400)
        }
    })

    router.post('/:id/git/push', zValidator('json', z.object({setUpstream: z.boolean().optional()})), async (c) => {
        const {setUpstream} = c.req.valid('json')
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return c.json({error: 'Not found'}, 404)
        if (!attempt.worktreePath) return c.json({error: 'No worktree for attempt'}, 409)
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
            return c.json({error: message}, 400)
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
        if (!attempt) return c.json({error: 'Not found'}, 404)
        if (!attempt.worktreePath) return c.json({error: 'No worktree for attempt'}, 409)
        const auth = await getGithubConnection().catch(() => null)
        if (!auth) return c.json({error: 'auth_required'}, 401)
        try {
            const {projects} = c.get('services')
            const settings = await projects.ensureSettings(attempt.boardId)
            const head = attempt.branchName?.trim()
            if (!head) return c.json({error: 'Branch name missing'}, 409)
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
            return c.json({pr}, 200)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'PR failed'
            return c.json({error: message}, 400)
        }
    })

    // Merge attempt branch into base branch (no push)
    router.post('/:id/git/merge', async (c) => {
        const attempt = await attempts.getAttempt(c.req.param('id'))
        if (!attempt) return c.json({error: 'Not found'}, 404)
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
            return c.json({error: message}, 400)
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
                console.error('[attempts:automation:dev] failed', error)
            }
            return c.json({error: message}, {status})
        }
    })

    return router
}
