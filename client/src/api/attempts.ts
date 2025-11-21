import type {Attempt, AttemptLog, ConversationAutomationItem, ConversationItem} from 'shared'
import {SERVER_URL} from '@/lib/env'

async function parseJson<T>(response: Response): Promise<T> {
    const text = await response.text()
    let data: unknown = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        // Non-JSON response body; proceed with text for error messages
    }
    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data ? (data as { error?: string }).error : null
        throw new Error(message || `Request failed with status ${response.status}`)
    }
    return data as T
}

export async function getAttempt(attemptId: string): Promise<Attempt> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}`)
    return parseJson<Attempt>(res)
}

export async function getAttemptLogs(attemptId: string): Promise<AttemptLog[]> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/logs`)
    const data = await parseJson<{ logs: AttemptLog[] }>(res)
    return data.logs ?? []
}

export async function getAttemptDetailForCard(projectId: string, cardId: string): Promise<{
    attempt: Attempt;
    logs: AttemptLog[];
    conversation: ConversationItem[]
}> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}/attempt`)
    return parseJson<{ attempt: Attempt; logs: AttemptLog[]; conversation: ConversationItem[] }>(res)
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
    return parseJson<Attempt>(res)
}

export async function followupAttemptRequest(attemptId: string, payload: { prompt: string; profileId?: string }) {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/followup`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Follow-up failed (${res.status})`)
    }
}

export async function stopAttemptRequest(attemptId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/stop`, {method: 'POST'})
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Stop failed (${res.status})`)
    }
}

export async function openAttemptEditor(attemptId: string, opts?: {
    subpath?: string;
    editorKey?: string;
    customCommand?: string
}): Promise<{ ok: true; command: { cmd: string; args: string[] } }> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/open-editor`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(opts ?? {}),
    })
    return parseJson<{ ok: true; command: { cmd: string; args: string[] } }>(res)
}

export async function runDevAutomationRequest(attemptId: string): Promise<ConversationAutomationItem> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/automation/dev`, {method: 'POST'})
    const data = await parseJson<{ item: ConversationAutomationItem }>(res)
    return data.item
}
