import type {AgentProfileGlobal} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {
    listGlobalAgentProfiles as listGlobalProfileRows,
    getGlobalAgentProfile as getGlobalAgentProfileRow,
    insertGlobalAgentProfile,
    updateGlobalAgentProfileRow,
    deleteGlobalAgentProfile as deleteGlobalAgentProfileRow,
} from './global-repo'

export type AgentProfileConfig = unknown

export async function listGlobalAgentProfiles(executor?: DbExecutor): Promise<AgentProfileGlobal[]> {
    return listGlobalProfileRows(executor)
}

export async function getGlobalAgentProfile(id: string, executor?: DbExecutor) {
    return getGlobalAgentProfileRow(id, executor)
}

export async function createGlobalAgentProfile(
    agent: string,
    name: string,
    config: AgentProfileConfig,
    executor?: DbExecutor,
) {
    const id = `apg-${crypto.randomUUID()}`
    const now = new Date()
    await insertGlobalAgentProfile(
        {
            id,
            agent,
            name,
            configJson: JSON.stringify(config),
            createdAt: now,
            updatedAt: now,
        },
        executor,
    )
    return getGlobalAgentProfile(id, executor)
}

export async function updateGlobalAgentProfile(
    id: string,
    patch: Partial<{ name: string; config: AgentProfileConfig }>,
    executor?: DbExecutor,
) {
    const now = new Date()
    const updates: Parameters<typeof updateGlobalAgentProfileRow>[1] = {updatedAt: now}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.config !== undefined) updates.configJson = JSON.stringify(patch.config)
    await updateGlobalAgentProfileRow(id, updates, executor)
    return getGlobalAgentProfile(id, executor)
}

export async function deleteGlobalAgentProfile(id: string, executor?: DbExecutor) {
    await deleteGlobalAgentProfileRow(id, executor)
}
