import {attempts, settingsService} from 'core'
import {openEditorAtPath} from '../editor/open'
import {problemJson} from '../http/problem'
import {log} from '../log'

export async function openEditorHandler(c: any) {
    const attemptId = c.req.param('id')
    const attempt = await attempts.getAttempt(attemptId)
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    const body = c.req.valid('json') as {subpath?: string; editorCommand?: string}
    if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
    const path = body?.subpath ? `${attempt.worktreePath}/${body.subpath}` : attempt.worktreePath
    const events = c.get('events')
    const settings = settingsService.snapshot()
    const editorCommand = body?.editorCommand ?? settings.editorCommand
    events.publish('editor.open.requested', {
        path,
        editorCommand,
        attemptId: attempt.id,
        projectId: attempt.boardId,
    })

    try {
        const result = await openEditorAtPath(path, {
            editorCommand: editorCommand || undefined,
        })
        if (!result) {
            return problemJson(c, {status: 400, detail: 'Editor not configured'})
        }
        const {spec, env} = result
        events.publish('editor.open.succeeded', {
            path,
            editorCommand,
            pid: undefined,
        })
        const runtimeEnv = c.get('config').env
        const envPath = env.PATH ?? runtimeEnv.PATH ?? ''
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
            editorCommand,
            error: error instanceof Error ? error.message : String(error),
        })
        log.error('attempts:editor', 'open failed', {err: error, attemptId: attempt.id, boardId: attempt.boardId})
        return problemJson(c, {status: 500, detail: 'Failed to open editor'})
    }
}
