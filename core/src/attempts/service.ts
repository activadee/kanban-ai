import type {AutomationStage, ConversationAutomationItem, MessageImage, ConversationItem} from 'shared'
import type {AppEventBus} from '../events/bus'
import {
    getAttempt as lifecycleGetAttempt,
    getLatestAttemptForCard as lifecycleGetLatestAttemptForCard,
    listAttemptLogs as lifecycleListAttemptLogs,
    startAttempt as lifecycleStartAttempt,
    stopAttempt as lifecycleStopAttempt,
    followupAttempt as lifecycleFollowupAttempt,
    type StartAttemptInput,
} from './lifecycle'
import {runAttemptAutomation as automationRunAttemptAutomation} from './automation'
import {listConversationItemsPaginated as repoListConversationItemsPaginated} from './repo'

type AttemptServiceDeps = {events: AppEventBus; images?: MessageImage[]}

function requireEvents(deps?: AttemptServiceDeps): AppEventBus {
    if (!deps?.events)
        throw new Error('Attempt service requires an event bus instance')
    return deps.events
}

export async function getAttempt(id: string) {
    return lifecycleGetAttempt(id)
}

export async function listAttemptLogs(attemptId: string) {
    return lifecycleListAttemptLogs(attemptId)
}

export async function getLatestAttemptForCard(boardId: string, cardId: string) {
    return lifecycleGetLatestAttemptForCard(boardId, cardId)
}

export async function startAttempt(
    input: StartAttemptInput,
    deps?: AttemptServiceDeps,
) {
    const events = requireEvents(deps)
    return lifecycleStartAttempt(input, events)
}

export async function stopAttempt(id: string, deps?: AttemptServiceDeps) {
    const events = requireEvents(deps)
    return lifecycleStopAttempt(id, events)
}

export async function runAttemptAutomation(
    attemptId: string,
    stage: AutomationStage,
    deps?: AttemptServiceDeps,
): Promise<ConversationAutomationItem> {
    const events = requireEvents(deps)
    return automationRunAttemptAutomation(attemptId, stage, events)
}

export async function followupAttempt(
    attemptId: string,
    prompt: string,
    profileId: string | undefined,
    deps?: AttemptServiceDeps,
) {
    const events = requireEvents(deps)
    return lifecycleFollowupAttempt(attemptId, prompt, profileId, events, deps?.images)
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

export async function listConversationItemsPaginated(
    attemptId: string,
    limit: number,
    offset: number,
): Promise<{items: ConversationItem[]; total: number; hasMore: boolean}> {
    const {items, total, hasMore} = await repoListConversationItemsPaginated(attemptId, limit, offset)
    return {
        items: items.map(deserializeConversationItem),
        total,
        hasMore,
    }
}
