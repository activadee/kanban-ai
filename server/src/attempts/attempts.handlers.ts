import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {attempts, projectDeps, projectsRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'
import {stopAttemptSchema, attemptMessageSchema} from './attempts.schemas'

const attemptIdParam = z.object({id: z.string()})

export const getAttemptHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    async (c) => {
        const {id} = c.req.valid('param')
        const attempt = await attempts.getAttempt(id)
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
        return c.json(attempt)
    },
)

export const stopAttemptHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    zValidator('json', stopAttemptSchema),
    async (c) => {
        const {id} = c.req.valid('param')
        const {status} = c.req.valid('json')
        if (status !== 'stopped') return problemJson(c, {status: 400, detail: 'Only status=stopped is supported'})

        const events = c.get('events')
        const attempt = await attempts.getAttempt(id)
        if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})

        const ok = await attempts.stopAttempt(id, {events})
        if (!ok) return problemJson(c, {status: 409, detail: 'Attempt is not running'})
        const updated = await attempts.getAttempt(id)
        return c.json({attempt: updated ?? null, status: updated?.status ?? 'stopped'})
    },
)

export const listAttemptLogsHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    async (c) => {
        const {id} = c.req.valid('param')
        const rows = await attempts.listAttemptLogs(id)
        return c.json({logs: rows})
    },
)

export const postAttemptMessageHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    zValidator('json', attemptMessageSchema),
    async (c) => {
        const {id} = c.req.valid('param')
        const {prompt, profileId} = c.req.valid('json')
        try {
            const attempt = await attempts.getAttempt(id)
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
            } catch {}

            const events = c.get('events')
            await attempts.followupAttempt(id, prompt, profileId, {events})
            return c.json({ok: true}, 201)
        } catch (err) {
            return problemJson(c, {
                status: 422,
                detail: err instanceof Error ? err.message : 'Follow-up failed',
            })
        }
    },
)

export const runDevAutomationHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    async (c) => {
        const {id} = c.req.valid('param')
        const events = c.get('events')
        try {
            const item = await attempts.runAttemptAutomation(id, 'dev', {events})
            return c.json({item})
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to run dev automation'
            let status = 500
            if (message === 'Attempt not found') status = 404
            else if (message.startsWith('No automation script configured')) status = 422
            else if (message.includes('Worktree is missing')) status = 409
            if (status >= 500) {
                log.error('attempts:automation:dev', 'failed', {err: error, attemptId: id})
            }
            return problemJson(c, {status, detail: message})
        }
    },
)
