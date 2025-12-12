import type {AutomationStage, ConversationAutomationItem, ImageAttachment} from 'shared'
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

type AttemptServiceDeps = {events: AppEventBus}

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
    attachments: ImageAttachment[] | undefined,
    deps?: AttemptServiceDeps,
) {
    const events = requireEvents(deps)
    return lifecycleFollowupAttempt(attemptId, prompt, profileId, attachments, events)
}
