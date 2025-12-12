import {Hono} from 'hono'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {
    gitCommitSchema,
    gitPushSchema,
    openEditorSchema,
    stopAttemptSchema,
    attemptPrSchema,
} from './attempts.schemas'
import {
    getAttemptHandler,
    getAttemptAttachmentHandler,
    listAttemptLogsHandler,
    postAttemptMessageHandler,
    runDevAutomationHandler,
    stopAttemptHandler,
} from './attempts.handlers'
import {openEditorHandler} from './attempts.editor.handlers'
import {
    gitCommitHandler,
    gitFileHandler,
    gitMergeHandler,
    gitPushHandler,
    gitStatusHandler,
} from './attempts.git.handlers'
import {createAttemptPrHandler} from './attempts.pr.handlers'
import {problemJson} from '../http/problem'

export const createAttemptsRouter = () => {
    const router = new Hono<AppEnv>()

    // Deprecated start path kept only to signal new canonical route
    router.post('/boards/:boardId/cards/:cardId/attempts', async (c) => {
        c.header('Deprecation', 'true')
        c.header('Link', '</api/v1/projects/{projectId}/cards/{cardId}/attempts>; rel="successor-version"')
        return problemJson(c, {status: 410, detail: 'Moved to /projects/:projectId/cards/:cardId/attempts'})
    })

    router.get('/:id', getAttemptHandler)

    router.patch('/:id', zValidator('json', stopAttemptSchema), stopAttemptHandler)

    // Keep old stop path as a deprecation hint
    router.post('/:id/stop', async (c) => {
        c.header('Deprecation', 'true')
        const id = c.req.param('id')
        c.header('Link', `</api/v1/attempts/${id}>; rel="successor-version"`)
        return problemJson(c, {status: 410, detail: 'Use PATCH /attempts/:id with status=stopped'})
    })

    router.get('/:id/logs', listAttemptLogsHandler)

    router.get('/:id/attachments/:fileName', getAttemptAttachmentHandler)

    // Open editor at worktree (or subpath)
    router.post('/:id/open-editor', zValidator('json', openEditorSchema), openEditorHandler)

    // Git endpoints per attempt (use worktree path)
    router.get('/:id/git/status', gitStatusHandler)

    router.get('/:id/git/file', gitFileHandler)

    router.post('/:id/messages', postAttemptMessageHandler)

    // Deprecated follow-up path
    router.post('/:id/followup', async (c) => {
        c.header('Deprecation', 'true')
        c.header('Link', '</api/v1/attempts/{id}/messages>; rel="successor-version"')
        return problemJson(c, {status: 410, detail: 'Use POST /attempts/:id/messages'})
    })

    // ---- Attempt-scoped Git write operations ----
    router.post('/:id/git/commit', zValidator('json', gitCommitSchema), gitCommitHandler)

    router.post('/:id/git/push', zValidator('json', gitPushSchema), gitPushHandler)

    router.post('/:id/github/pr', zValidator('json', attemptPrSchema), createAttemptPrHandler)

    // Merge attempt branch into base branch (no push)
    router.post('/:id/git/merge', gitMergeHandler)

    router.post('/:id/automation/dev', runDevAutomationHandler)

    return router
}
