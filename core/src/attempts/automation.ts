import {existsSync} from 'fs'
import type {
    AutomationStage,
    ConversationAutomationItem,
    ConversationItem,
} from 'shared'
import {runAutomationCommand} from '../automation/scripts'
import type {AppEventBus} from '../events/bus'
import {ensureProjectSettings} from '../projects/settings/service'
import {getBoardById, getCardById} from '../projects/repo'
import {getWorktreePath, getWorktreePathByNames} from '../ports/worktree'
import {
    getAttemptById,
    getNextConversationSeq,
    insertConversationItem,
    type ConversationItemInsert,
} from './repo'

export function normalizeAutomationScript(source: string | null | undefined): string | null {
    if (typeof source !== 'string') return null
    const trimmed = source.trim()
    return trimmed.length ? trimmed : null
}

export async function appendAutomationConversationItem(
    attemptId: string,
    boardId: string,
    item: ConversationAutomationItem,
    events: AppEventBus,
    seq?: number,
) {
    const ts = (() => {
        const parsed = Date.parse(item.timestamp)
        if (Number.isFinite(parsed)) return new Date(parsed)
        return new Date()
    })()
    const recordId = item.id ?? `auto-${crypto.randomUUID()}`
    const payload: ConversationAutomationItem = {
        ...item,
        id: recordId,
        timestamp: item.timestamp ?? ts.toISOString(),
    }
    const seqValue =
        typeof seq === 'number' ? seq : await getNextConversationSeq(attemptId)
    const insert: ConversationItemInsert = {
        id: recordId,
        attemptId,
        seq: seqValue,
        ts,
        itemJson: JSON.stringify(payload),
    }
    await insertConversationItem(insert)
    events.publish('attempt.conversation.appended', {
        attemptId,
        boardId,
        item: payload as ConversationItem,
    })
    return payload
}

export type AutomationStageOptions = {
    failHard?: boolean
}

export type AutomationConversationEmitter = (
    item: ConversationAutomationItem,
) => Promise<void> | void

export async function runAutomationStageInWorktree(
    stage: AutomationStage,
    script: string | null,
    worktreePath: string,
    emitConversation?: AutomationConversationEmitter,
    options?: AutomationStageOptions,
): Promise<ConversationAutomationItem | null> {
    if (!script) return null
    const item = await runAutomationCommand({
        stage,
        command: script,
        cwd: worktreePath,
    })
    if (emitConversation) await emitConversation(item)
    if (options?.failHard && item.exitCode !== 0) {
        throw new Error(
            `[automation:${stage}] exited with code ${item.exitCode ?? -1}`,
        )
    }
    return item
}

export function createCleanupRunner(
    script: string | null,
    worktreePath: string,
    emitConversation?: AutomationConversationEmitter,
): () => Promise<void> {
    let invoked = false
    return async () => {
        if (invoked) return
        invoked = true
        if (!script) return
        await runAutomationStageInWorktree(
            'cleanup',
            script,
            worktreePath,
            emitConversation,
            {failHard: false},
        )
    }
}

export async function runAttemptAutomation(
    attemptId: string,
    stage: AutomationStage,
    events: AppEventBus,
): Promise<ConversationAutomationItem> {
    const attempt = await getAttemptById(attemptId)
    if (!attempt) throw new Error('Attempt not found')
    const settings = await ensureProjectSettings(attempt.boardId)
    const scriptSource = (() => {
        switch (stage) {
            case 'copy_files':
                return settings.copyFiles
            case 'setup':
                return settings.setupScript
            case 'dev':
                return settings.devScript
            case 'cleanup':
                return settings.cleanupScript
            default:
                return null
        }
    })()
    const script = normalizeAutomationScript(scriptSource)
    if (!script) {
        throw new Error(`No automation script configured for stage ${stage}`)
    }
    let worktreePath = attempt.worktreePath
    if (!worktreePath) {
        const cardRow = await getCardById(attempt.cardId)
        const boardRow = await getBoardById(attempt.boardId)
        worktreePath = boardRow
            ? getWorktreePathByNames(
                  boardRow.name,
                  cardRow?.title ?? attempt.cardId,
              )
            : getWorktreePath(attempt.boardId, attempt.id)
    }
    if (!worktreePath) {
        throw new Error('Worktree path not available for attempt')
    }
    if (!existsSync(worktreePath)) {
        throw new Error(
            'Worktree is missing; start a new attempt before running automation',
        )
    }
    const item = await runAutomationCommand({
        stage,
        command: script,
        cwd: worktreePath,
    })
    const saved = await appendAutomationConversationItem(
        attemptId,
        attempt.boardId,
        item,
        events,
    )
    return saved
}
