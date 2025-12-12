import {attempts, projectDeps, projectsRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {attemptMessageSchema} from './attempts.schemas'
import {join, resolve, sep} from 'node:path'
import {promises as fsp} from 'node:fs'

const DEFAULT_MAX_FOLLOWUP_BODY_BYTES = 32 * 1024 * 1024

function resolveMaxFollowupBodyBytes(): number {
    const raw = process.env.KANBANAI_MAX_FOLLOWUP_BODY_BYTES?.trim()
    if (!raw) return DEFAULT_MAX_FOLLOWUP_BODY_BYTES
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_FOLLOWUP_BODY_BYTES
    return Math.floor(n)
}

async function readRequestTextWithLimit(req: Request, maxBytes: number): Promise<string> {
    const lenHeader = req.headers.get('content-length')
    if (lenHeader) {
        const declared = Number(lenHeader)
        if (Number.isFinite(declared) && declared > maxBytes) {
            const err = new Error('Request body too large')
            ;(err as any).code = 'BODY_TOO_LARGE'
            throw err
        }
    }

    if (!req.body) return ''
    const reader = req.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
        const {value, done} = await reader.read()
        if (done) break
        if (value) {
            total += value.byteLength
            if (total > maxBytes) {
                const err = new Error('Request body too large')
                ;(err as any).code = 'BODY_TOO_LARGE'
                throw err
            }
            chunks.push(value)
        }
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
    }
    return new TextDecoder().decode(out)
}

async function parseJsonBodyWithLimit(req: Request, maxBytes: number): Promise<unknown> {
    const text = await readRequestTextWithLimit(req, maxBytes)
    if (!text.trim().length) return {}
    try {
        return JSON.parse(text) as unknown
    } catch {
        const err = new Error('Invalid JSON')
        ;(err as any).code = 'INVALID_JSON'
        throw err
    }
}

export async function getAttemptHandler(c: any) {
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    return c.json(attempt)
}

export async function getAttemptAttachmentHandler(c: any) {
    const attemptId = c.req.param('id')
    const fileName = String(c.req.param('fileName') ?? '')

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        return problemJson(c, {status: 400, detail: 'Invalid attachment name'})
    }

    const attempt = await attempts.getAttempt(attemptId)
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'Attempt worktree is missing'})

    const sanitizeFsSegment = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown'
    const resolveChildPath = (baseDir: string, child: string) => {
        const base = resolve(baseDir)
        const out = resolve(baseDir, child)
        const prefix = base.endsWith(sep) ? base : base + sep
        if (!out.startsWith(prefix)) throw new Error('Attachment path escaped base directory')
        return out
    }

    const safeAttemptId = sanitizeFsSegment(attemptId)
    const dir = resolveChildPath(join(attempt.worktreePath, '.kanbanai', 'attachments'), safeAttemptId)
    const filePath = resolveChildPath(dir, fileName)

    const ext = fileName.split('.').pop()?.toLowerCase()
    const mime =
        ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'webp'
                ? 'image/webp'
                : null
    if (!mime) return problemJson(c, {status: 400, detail: 'Unsupported attachment type'})

    try {
        const buf = await fsp.readFile(filePath)
        c.header('Content-Type', mime)
        c.header('Cache-Control', 'private, no-store')
        return c.body(buf, 200)
    } catch (err) {
        const code = (err as any)?.code
        if (code === 'ENOENT') return problemJson(c, {status: 404, detail: 'Attachment not found'})
        log.error('attempts:attachments', 'failed to serve attachment', {err, attemptId, fileName})
        return problemJson(c, {status: 500, detail: 'Failed to read attachment'})
    }
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
    const maxBytes = resolveMaxFollowupBodyBytes()
    let parsedBody: unknown
    try {
        parsedBody = await parseJsonBodyWithLimit(c.req.raw, maxBytes)
    } catch (err) {
        const code = (err as any)?.code
        if (code === 'BODY_TOO_LARGE') {
            return problemJson(c, {status: 413, detail: `Request body too large (max ${maxBytes} bytes)`})
        }
        if (code === 'INVALID_JSON') {
            return problemJson(c, {status: 400, detail: 'Invalid JSON'})
        }
        return problemJson(c, {status: 400, detail: 'Invalid request body'})
    }

    const validated = attemptMessageSchema.safeParse(parsedBody)
    if (!validated.success) {
        return problemJson(c, {
            status: 400,
            detail: 'Invalid message payload',
            errors: validated.error.flatten(),
        })
    }

    const {prompt = '', profileId, images} = validated.data
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
        await attempts.followupAttempt(c.req.param('id'), prompt, profileId, images as any, {events})
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
