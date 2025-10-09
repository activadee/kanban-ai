import type {AgentProfileRow, AgentProfileSchemaResponse, AgentsListResponse} from 'shared'
import {SERVER_URL} from '@/lib/env'

async function parseJson<T>(response: Response): Promise<T> {
    const text = await response.text()
    let data: unknown = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        // Non-JSON response body; treat as plain text and fall through to status handling
    }
    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data ? (data as { error?: string }).error : null
        throw new Error(message || `Request failed with status ${response.status}`)
    }
    return data as T
}

export async function listAgents(): Promise<AgentsListResponse> {
    const res = await fetch(`${SERVER_URL}/agents`)
    return parseJson<AgentsListResponse>(res)
}

export async function listAgentProfiles(): Promise<AgentProfileRow[]> {
    const res = await fetch(`${SERVER_URL}/agents/profiles`)
    const data = await parseJson<{ profiles: AgentProfileRow[] }>(res)
    return data.profiles
}

export async function getAgentSchema(agentKey: string): Promise<AgentProfileSchemaResponse> {
    const res = await fetch(`${SERVER_URL}/agents/${agentKey}/schema`)
    return parseJson<AgentProfileSchemaResponse>(res)
}

export async function createAgentProfileRequest(payload: {
    agent: string;
    name: string;
    config: unknown
}): Promise<AgentProfileRow> {
    const res = await fetch(`${SERVER_URL}/agents/profiles`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseJson<AgentProfileRow>(res)
}

export async function deleteAgentProfileRequest(profileId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/agents/profiles/${profileId}`, {method: 'DELETE'})
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed to delete profile (${res.status})`)
    }
}

export async function updateAgentProfileRequest(profileId: string, payload: {
    name?: string;
    config?: unknown
}): Promise<AgentProfileRow> {
    const res = await fetch(`${SERVER_URL}/agents/profiles/${profileId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseJson<AgentProfileRow>(res)
}
