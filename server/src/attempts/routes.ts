import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    getAttemptHandlers,
    listAttemptLogsHandlers,
    postAttemptMessageHandlers,
    runDevAutomationHandlers,
    stopAttemptHandlers,
} from './attempts.handlers'
import {openEditorHandlers} from './attempts.editor.handlers'
import {
    gitCommitHandlers,
    gitFileHandlers,
    gitMergeHandlers,
    gitPushHandlers,
    gitStatusHandlers,
} from './attempts.git.handlers'
import {createAttemptPrHandlers} from './attempts.pr.handlers'
import {problemJson} from '../http/problem'

export const createAttemptsRouter = () =>
    new Hono<AppEnv>()
        .post('/boards/:boardId/cards/:cardId/attempts', async (c) => {
            c.header('Deprecation', 'true')
            c.header('Link', '</api/v1/projects/{projectId}/cards/{cardId}/attempts>; rel="successor-version"')
            return problemJson(c, {status: 410, detail: 'Moved to /projects/:projectId/cards/:cardId/attempts'})
        })
        .get('/:id', ...getAttemptHandlers)
        .patch('/:id', ...stopAttemptHandlers)
        .post('/:id/stop', async (c) => {
            c.header('Deprecation', 'true')
            const id = c.req.param('id')
            c.header('Link', `</api/v1/attempts/${id}>; rel="successor-version"`)
            return problemJson(c, {status: 410, detail: 'Use PATCH /attempts/:id with status=stopped'})
        })
        .get('/:id/logs', ...listAttemptLogsHandlers)
        .post('/:id/open-editor', ...openEditorHandlers)
        .get('/:id/git/status', ...gitStatusHandlers)
        .get('/:id/git/file', ...gitFileHandlers)
        .post('/:id/messages', ...postAttemptMessageHandlers)
        .post('/:id/followup', async (c) => {
            c.header('Deprecation', 'true')
            c.header('Link', '</api/v1/attempts/{id}/messages>; rel="successor-version"')
            return problemJson(c, {status: 410, detail: 'Use POST /attempts/:id/messages'})
        })
        .post('/:id/git/commit', ...gitCommitHandlers)
        .post('/:id/git/push', ...gitPushHandlers)
        .post('/:id/github/pr', ...createAttemptPrHandlers)
        .post('/:id/git/merge', ...gitMergeHandlers)
        .post('/:id/automation/dev', ...runDevAutomationHandlers)

export type AttemptsRoutes = ReturnType<typeof createAttemptsRouter>
