import type {AgentProfileGlobalRow} from '../db/types'
import {
    listGlobalAgentProfiles as listGlobalProfileRows,
    getGlobalAgentProfile as getGlobalAgentProfileRow,
    insertGlobalAgentProfile,
    updateGlobalAgentProfileRow,
    deleteGlobalAgentProfile as deleteGlobalAgentProfileRow,
} from './global-repo'

export type AgentProfileConfig = unknown

export async function listGlobalAgentProfiles(): Promise<AgentProfileGlobalRow[]> {
    return listGlobalProfileRows()
}

export async function getGlobalAgentProfile(id: string) {
    return getGlobalAgentProfileRow(id)
}

export async function createGlobalAgentProfile(
    agent: string,
    name: string,
    config: AgentProfileConfig,
) {
    const id = `apg-${crypto.randomUUID()}`
    const now = new Date()
    await insertGlobalAgentProfile({
        id,
        agent,
        name,
        configJson: JSON.stringify(config),
        createdAt: now,
        updatedAt: now,
    })
    return getGlobalAgentProfile(id)
}

export async function updateGlobalAgentProfile(
    id: string,
    patch: Partial<{ name: string; config: AgentProfileConfig }>,
) {
    const now = new Date()
    const updates: Parameters<typeof updateGlobalAgentProfileRow>[1] = {updatedAt: now}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.config !== undefined) updates.configJson = JSON.stringify(patch.config)
    await updateGlobalAgentProfileRow(id, updates)
    return getGlobalAgentProfile(id)
}

export async function deleteGlobalAgentProfile(id: string) {
    await deleteGlobalAgentProfileRow(id)
}
