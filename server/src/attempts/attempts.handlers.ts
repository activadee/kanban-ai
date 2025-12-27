import {attempts, projectDeps, projectsRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'

export async function getAttemptHandler(c: any) {
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    return c.json(attempt)
}

export async function stopAttemptHandler(c: any) {
    const {status} = c.req.valid('json') as {status: string}
    if (status !== 'stopped') return problemJson(c, {status: 400, detail: 'Only status=stopped is supported'})

    const events = c.get('events')
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})

    const ok = await attempts.stopAttempt(c.req.param('id'), {events})
    if (!ok) return problemJson(c, {status: 409, detail: 'Attempt is not running'})
    const updated = await attempts.getAttempt(c.req.param('id'))
    return c.json({attempt: updated ?? null, status: updated?.status ?? 'stopped'})
}

export async function listAttemptLogsHandler(c: any) {
    const rows = await attempts.listAttemptLogs(c.req.param('id'))
    return c.json({logs: rows})
}

export async function postAttemptMessageHandler(c: any) {
    const {prompt, profileId} = c.req.valid('json') as {prompt: string; profileId?: string}
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
        if (attempt.isPlanningAttempt !== true) {
            try {
                const {blocked} = await projectDeps.isCardBlocked(attempt.cardId)
                if (blocked) return problemJson(c, {status: 409, detail: 'Task is blocked by dependencies'})
            } catch {
            }
        }

        const events = c.get('events')
        await attempts.followupAttempt(c.req.param('id'), prompt, profileId, {events})
        return c.json({ok: true}, 201)
    } catch (err) {
        return problemJson(c, {
            status: 422,
            detail: err instanceof Error ? err.message : 'Follow-up failed',
        })
    }
}

export async function runDevAutomationHandler(c: any) {
    const events = c.get('events')
    try {
        const item = await attempts.runAttemptAutomation(c.req.param('id'), 'dev', {events})
        return c.json({item})
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run dev automation'
        let status = 500
        if (message === 'Attempt not found') status = 404
        else if (message.startsWith('No automation script configured')) status = 422
        else if (message.includes('Worktree is missing')) status = 409
        if (status >= 500) {
            log.error('attempts:automation:dev', 'failed', {err: error, attemptId: c.req.param('id')})
        }
        return problemJson(c, {status, detail: message})
    }
}
