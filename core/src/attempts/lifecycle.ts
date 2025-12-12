import type {
    AttemptStatus,
    ConversationItem,
    AttemptTodoSummary,
    ImageAttachment,
    ImageMimeType,
} from 'shared'
import type {AppEventBus} from '../events/bus'
import {ensureProjectSettings} from '../projects/settings/service'
import {getRepositoryPath, getBoardById, getCardById} from '../projects/repo'
import {getWorktreePath, getWorktreePathByNames} from '../ports/worktree'
import {getAgent} from '../agents/registry'
import {renderBranchName} from '../git/branch'
import {settingsService} from '../settings/service'
import {
    getAttemptById,
    getAttemptForCard,
    insertAttempt,
    updateAttempt,
    listAttemptLogs as repoListAttemptLogs,
    listConversationItems as repoListConversationItems,
    getAttemptTodos as repoGetAttemptTodos,
} from './repo'
import {
    abortRunningAttempt,
    startAttemptWorker,
    startFollowupAttemptWorker,
} from './worker'
import {normalizeAutomationScript} from './automation'

export type StartAttemptInput = {
    boardId: string
    cardId: string
    agent: string
    baseBranch?: string
    branchName?: string
    profileId?: string
}

export async function getAttempt(id: string) {
    return getAttemptById(id)
}

export async function listAttemptLogs(attemptId: string) {
    return repoListAttemptLogs(attemptId)
}

function deserializeConversationItem(row: {
    id: string
    ts: Date | number
    itemJson: string
}): ConversationItem {
    try {
        const parsed = JSON.parse(row.itemJson) as ConversationItem
        const timestamp = parsed.timestamp ?? new Date(row.ts).toISOString()
        return {...parsed, id: parsed.id ?? row.id, timestamp}
    } catch {
        return {
            type: 'error',
            timestamp: new Date().toISOString(),
            text: 'Failed to load conversation entry',
        }
    }
}

const MAX_IMAGES_PER_MESSAGE = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES: ImageMimeType[] = [
    'image/png',
    'image/jpeg',
    'image/webp',
]

function validateImageAttachments(raw: ImageAttachment[] | undefined): ImageAttachment[] {
    if (!raw || raw.length === 0) return []
    if (raw.length > MAX_IMAGES_PER_MESSAGE) {
        throw new Error(`Too many images attached (max ${MAX_IMAGES_PER_MESSAGE})`)
    }
    const validated: ImageAttachment[] = []
    for (const att of raw) {
        const dataUrl = (att.dataUrl ?? '').trim()
        const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/i.exec(dataUrl)
        if (!match) throw new Error('Unsupported image data URL')
        const mimeSource = match[1]
        const payload = match[2]
        if (!mimeSource || !payload) throw new Error('Unsupported image data URL')
        const mimeType = mimeSource.toLowerCase() as ImageMimeType
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
            throw new Error(`Unsupported image format: ${mimeType}`)
        }
        const buf = Buffer.from(payload, 'base64')
        if (buf.byteLength > MAX_IMAGE_BYTES) {
            throw new Error(`Image exceeds ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit`)
        }
        const id = att.id?.trim() || `img-${crypto.randomUUID()}`
        validated.push({
            ...att,
            id,
            mimeType,
            sizeBytes: buf.byteLength,
        })
    }
    return validated
}

export async function getLatestAttemptForCard(boardId: string, cardId: string) {
    const selected = await getAttemptForCard(boardId, cardId)
    if (!selected) return null
    const logs = await repoListAttemptLogs(selected.id)
    const items = await repoListConversationItems(selected.id)
    const todosSummary = await (async (): Promise<AttemptTodoSummary | null> => {
        const row = await repoGetAttemptTodos(selected.id)
        if (!row) return null
        try {
            const parsed = JSON.parse(row.todosJson) as AttemptTodoSummary
            const total = Array.isArray(parsed.items) ? parsed.items.length : 0
            const completed = Array.isArray(parsed.items)
                ? parsed.items.filter((t) => t.status === 'done').length
                : 0
            return {
                total,
                completed,
                items: Array.isArray(parsed.items) ? parsed.items : [],
            }
        } catch {
            return null
        }
    })()
    return {
        attempt: selected,
        logs,
        conversation: items.map(deserializeConversationItem),
        todos: todosSummary,
    }
}

export async function startAttempt(
    input: StartAttemptInput,
    events: AppEventBus,
) {
    const now = new Date()
    const repoPath = await (async () => {
        const p = await getRepositoryPath(input.boardId)
        if (!p) throw new Error('Board not found')
        return p
    })()
    const settings = await ensureProjectSettings(input.boardId)
    const existing = await getAttemptForCard(input.boardId, input.cardId)
    const cardRow = await getCardById(input.cardId)
    const boardRow = await getBoardById(input.boardId)
    let id = existing?.id ?? `att-${crypto.randomUUID()}`
    const base =
        existing?.baseBranch ??
        input.baseBranch ??
        settings.baseBranch ??
        'main'

    let branch = existing?.branchName ?? input.branchName
    if (!branch) {
        const tmpl =
            settingsService.snapshot().branchTemplate ||
            '{prefix}/{ticketKey}-{slug}'
        const ticket = cardRow?.ticketKey ?? undefined
        const slugSource = cardRow?.title ?? ticket ?? undefined
        const prefix = settings.ticketPrefix
        branch = renderBranchName(tmpl, {
            prefix,
            ticketKey: ticket,
            slugSource,
            type: cardRow?.ticketType ?? undefined,
        })
    }
    if (!branch) branch = `kanbanai/${Math.random().toString(36).slice(2, 8)}`
    const defaultWorktreePath = boardRow
        ? getWorktreePathByNames(
              boardRow.name,
              cardRow?.title ?? `card-${input.cardId}`,
          )
        : getWorktreePath(input.boardId, id)
    const worktreePath = existing?.worktreePath ?? defaultWorktreePath
    const profileId = input.profileId ?? settings.defaultProfileId ?? undefined

    const previousStatus: AttemptStatus =
        (existing?.status as AttemptStatus | undefined) ?? 'queued'

    if (!existing) {
        await insertAttempt({
            id,
            cardId: input.cardId,
            boardId: input.boardId,
            agent: input.agent,
            status: 'queued',
            baseBranch: base,
            branchName: branch,
            worktreePath,
            createdAt: now,
            updatedAt: now,
        })
    } else {
        if (existing.status === 'running' || existing.status === 'stopping')
            throw new Error('Attempt already running')
        await updateAttempt(existing.id, {
            agent: input.agent,
            status: 'queued',
            baseBranch: base,
            branchName: branch,
            worktreePath,
            startedAt: null,
            endedAt: null,
            updatedAt: now,
        })
    }

    const copyScript = normalizeAutomationScript(settings.copyFiles)
    const setupScript = normalizeAutomationScript(settings.setupScript)
    const cleanupScript = normalizeAutomationScript(settings.cleanupScript)
    const allowScriptsToFail = settings.allowScriptsToFail ?? false
    const allowCopyFilesToFail = settings.allowCopyFilesToFail ?? false
    const allowSetupScriptToFail = settings.allowSetupScriptToFail ?? false
    const allowDevScriptToFail = settings.allowDevScriptToFail ?? false
    const allowCleanupScriptToFail = settings.allowCleanupScriptToFail ?? false

    events.publish('attempt.queued', {
        attemptId: id,
        boardId: input.boardId,
        cardId: input.cardId,
        agent: input.agent,
        baseBranch: base,
        branchName: branch,
        profileId,
    })

    startAttemptWorker(
        {
            attemptId: id,
            boardId: input.boardId,
            cardId: input.cardId,
            agentKey: input.agent,
            repoPath,
            worktreePath,
            baseBranch: base,
            branchName: branch,
            profileId,
            previousStatus,
            cardTitle: cardRow?.title ?? '(untitled)',
            cardDescription: cardRow?.description ?? null,
            ticketType: cardRow?.ticketType ?? null,
            automation: {
                copyScript,
                setupScript,
                cleanupScript,
                allowScriptsToFail,
                allowCopyFilesToFail,
                allowSetupScriptToFail,
                allowDevScriptToFail,
                allowCleanupScriptToFail,
            },
        },
        events,
    )

    const out = await getAttemptById(id)
    if (!out) throw new Error('Failed to start attempt')
    return out
}

export async function stopAttempt(id: string, events: AppEventBus) {
    try {
        const attempt = await getAttemptById(id)
        if (!attempt) return false

        const meta = abortRunningAttempt(id)

        if (meta) {
            const updatedAt = new Date()
            await updateAttempt(id, {status: 'stopping', updatedAt})
            events.publish('attempt.status.changed', {
                attemptId: id,
                boardId: meta.boardId,
                status: 'stopping',
                previousStatus: 'running',
                endedAt: null,
            })
            events.publish('attempt.stopped', {
                attemptId: id,
                boardId: meta.boardId,
                reason: 'user',
            })
            return true
        }

        const activeStatuses: AttemptStatus[] = ['running', 'stopping', 'queued']
        if (activeStatuses.includes(attempt.status as AttemptStatus)) {
            const now = new Date()
            await updateAttempt(id, {
                status: 'stopped',
                endedAt: now,
                updatedAt: now,
            })
            events.publish('attempt.status.changed', {
                attemptId: id,
                boardId: attempt.boardId,
                status: 'stopped',
                previousStatus: attempt.status as AttemptStatus,
                endedAt: now.toISOString(),
            })
            events.publish('attempt.stopped', {
                attemptId: id,
                boardId: attempt.boardId,
                reason: 'force',
            })
            return true
        }

        return false
    } catch (error) {
        console.error('Error stopping attempt:', error)
    }
}

export async function followupAttempt(
    attemptId: string,
    prompt: string,
    profileId: string | undefined,
    attachments: ImageAttachment[] | undefined,
    events: AppEventBus,
) {
    const base = await getAttemptById(attemptId)
    if (!base) throw new Error('Attempt not found')
    if (!base.sessionId)
        throw new Error('No session recorded for this attempt')
    if (base.status === 'running' || base.status === 'stopping')
        throw new Error('Attempt already running')
    const agent = getAgent(base.agent)
    if (!agent || typeof agent.resume !== 'function')
        throw new Error('Agent does not support follow-up')
    const settings = await ensureProjectSettings(base.boardId)
    const effectiveProfileId =
        profileId ?? settings.defaultProfileId ?? undefined
    const copyScript = normalizeAutomationScript(settings.copyFiles)
    const setupScript = normalizeAutomationScript(settings.setupScript)
    const cleanupScript = normalizeAutomationScript(settings.cleanupScript)
    const allowScriptsToFail = settings.allowScriptsToFail ?? false
    const allowCopyFilesToFail = settings.allowCopyFilesToFail ?? false
    const allowSetupScriptToFail = settings.allowSetupScriptToFail ?? false
    const allowDevScriptToFail = settings.allowDevScriptToFail ?? false
    const allowCleanupScriptToFail = settings.allowCleanupScriptToFail ?? false
    const validatedAttachments = validateImageAttachments(attachments)
    const now = new Date()
    const repoPath = await (async () => {
        const p = await getRepositoryPath(base.boardId)
        if (!p) throw new Error('Board not found')
        return p
    })()
    let worktreePath = base.worktreePath
    if (!worktreePath) {
        const cardRow = await getCardById(base.cardId)
        const boardRow = await getBoardById(base.boardId)
        worktreePath = boardRow
            ? getWorktreePathByNames(
                  boardRow.name,
                  cardRow?.title ?? base.cardId,
              )
            : getWorktreePath(base.boardId, base.id)
    }
    await updateAttempt(base.id, {
        status: 'queued',
        worktreePath,
        updatedAt: now,
        startedAt: null,
        endedAt: null,
    })
    events.publish('attempt.queued', {
        attemptId: base.id,
        boardId: base.boardId,
        cardId: base.cardId,
        agent: base.agent,
        branchName: base.branchName,
        baseBranch: base.baseBranch,
        profileId: effectiveProfileId ?? undefined,
    })

    startFollowupAttemptWorker(
        {
            attemptId: base.id,
            boardId: base.boardId,
            cardId: base.cardId,
            agentKey: base.agent,
            repoPath,
            worktreePath,
            baseBranch: base.baseBranch,
            branchName: base.branchName,
            profileId: effectiveProfileId ?? undefined,
            previousStatus: base.status as AttemptStatus,
            cardTitle: '',
            cardDescription: null,
            sessionId: base.sessionId,
            followupPrompt: prompt,
            followupAttachments: validatedAttachments,
            automation: {
                copyScript,
                setupScript,
                cleanupScript,
                allowScriptsToFail,
                allowCopyFilesToFail,
                allowSetupScriptToFail,
                allowDevScriptToFail,
                allowCleanupScriptToFail,
            },
        },
        events,
    )
}
