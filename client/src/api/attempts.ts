import type {Attempt, AttemptLog, ConversationAutomationItem, ConversationItem} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function getAttempt(attemptId: string): Promise<Attempt> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}`)
    return parseApiResponse<Attempt>(res)
}

export async function getAttemptLogs(attemptId: string): Promise<AttemptLog[]> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/logs`)
    const data = await parseApiResponse<{ logs: AttemptLog[] }>(res)
    return data.logs ?? []
}

export async function getAttemptDetailForCard(projectId: string, cardId: string): Promise<{
    attempt: Attempt;
    logs: AttemptLog[];
    conversation: ConversationItem[]
}> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}/attempt`)
    return parseApiResponse<{ attempt: Attempt; logs: AttemptLog[]; conversation: ConversationItem[] }>(res)
}

export async function startAttemptRequest(params: {
    projectId: string;
    cardId: string;
    agent: string;
    profileId?: string;
    baseBranch?: string;
    branchName?: string
}) {
    const res = await fetch(`${SERVER_URL}/projects/${params.projectId}/cards/${params.cardId}/attempts`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            agent: params.agent,
            profileId: params.profileId,
            baseBranch: params.baseBranch,
            branchName: params.branchName
        }),
    })
    return parseApiResponse<Attempt>(res)
}

export async function followupAttemptRequest(attemptId: string, payload: { prompt: string; profileId?: string }) {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    await parseApiResponse(res)
}

export async function stopAttemptRequest(attemptId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: 'stopped'}),
    })
    await parseApiResponse(res)
}

export async function openAttemptEditor(attemptId: string, opts?: {
    subpath?: string;
    editorKey?: string;
}): Promise<{ ok: true; command: { cmd: string; args: string[] } }> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/open-editor`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(opts ?? {}),
    })
    return parseApiResponse<{ ok: true; command: { cmd: string; args: string[] } }>(res)
}

export async function runDevAutomationRequest(attemptId: string): Promise<ConversationAutomationItem> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/automation/dev`, {method: 'POST'})
    const data = await parseApiResponse<{ item: ConversationAutomationItem }>(res)
    return data.item
}
