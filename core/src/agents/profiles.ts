import type {AgentProfileRow} from '../db/types'
import {
    listAgentProfiles as listAgentProfileRows,
    getAgentProfile as getAgentProfileRow,
    insertAgentProfile,
    updateAgentProfileRow,
    deleteAgentProfile as deleteAgentProfileRow,
} from './repo'

export type AgentProfileConfig = unknown

export async function listAgentProfiles(projectId: string) {
    return listAgentProfileRows(projectId)
}

export async function getAgentProfile(projectId: string, id: string) {
    return getAgentProfileRow(projectId, id)
}

export async function createAgentProfile(
    projectId: string,
    agent: string,
    name: string,
    config: AgentProfileConfig,
): Promise<AgentProfileRow> {
    const id = `ap-${crypto.randomUUID()}`
    const now = new Date()
    await insertAgentProfile({
        id,
        projectId,
        agent,
        name,
        configJson: JSON.stringify(config),
        createdAt: now,
        updatedAt: now,
    })
    const row = await getAgentProfile(projectId, id)
    if (!row) throw new Error('Failed to create agent profile')
    return row
}

export async function updateAgentProfile(
    projectId: string,
    id: string,
    patch: Partial<{ name: string; config: AgentProfileConfig }>,
) {
    const now = new Date()
    const updates: Parameters<typeof updateAgentProfileRow>[2] = {updatedAt: now}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.config !== undefined) updates.configJson = JSON.stringify(patch.config)
    await updateAgentProfileRow(projectId, id, updates)
    return getAgentProfile(projectId, id)
}

export async function deleteAgentProfile(projectId: string, id: string) {
    await deleteAgentProfileRow(projectId, id)
}
