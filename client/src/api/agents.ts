import type {AgentProfileRow, AgentProfileSchemaResponse, AgentsListResponse} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function listAgents(): Promise<AgentsListResponse> {
    const res = await fetch(`${SERVER_URL}/agents`)
    return parseApiResponse<AgentsListResponse>(res)
}

export async function listAgentProfiles(): Promise<AgentProfileRow[]> {
    const res = await fetch(`${SERVER_URL}/agents/profiles`)
    const data = await parseApiResponse<{ profiles: AgentProfileRow[] }>(res)
    return data.profiles
}

export async function getAgentSchema(agentKey: string): Promise<AgentProfileSchemaResponse> {
    const res = await fetch(`${SERVER_URL}/agents/${agentKey}/schema`)
    return parseApiResponse<AgentProfileSchemaResponse>(res)
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
    return parseApiResponse<AgentProfileRow>(res)
}

export async function deleteAgentProfileRequest(profileId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/agents/profiles/${profileId}`, {method: 'DELETE'})
    await parseApiResponse(res)
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
    return parseApiResponse<AgentProfileRow>(res)
}
