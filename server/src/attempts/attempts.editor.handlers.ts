import {attempts, settingsService} from 'core'
import {openEditorAtPath} from '../editor/service'
import {problemJson} from '../http/problem'
import {log} from '../log'

export async function openEditorHandler(c: any) {
    const attemptId = c.req.param('id')
    const attempt = await attempts.getAttempt(attemptId)
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    const body = c.req.valid('json') as {subpath?: string; editorKey?: string}
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
            editorKey: attemptedEditorKey ?? 'VS_CODE',
            error: error instanceof Error ? error.message : String(error),
        })
        log.error('attempts:editor', 'open failed', {err: error, attemptId: attempt.id, boardId: attempt.boardId})
        return problemJson(c, {status: 500, detail: 'Failed to open editor'})
    }
}
