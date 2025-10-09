import type {AgentProfile} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {
    listAgentProfiles as listAgentProfileRows,
    getAgentProfile as getAgentProfileRow,
    insertAgentProfile,
    updateAgentProfileRow,
    deleteAgentProfile as deleteAgentProfileRow,
} from './repo'

export type AgentProfileConfig = unknown

export async function listAgentProfiles(projectId: string, executor?: DbExecutor) {
    return listAgentProfileRows(projectId, executor)
}

export async function getAgentProfile(projectId: string, id: string, executor?: DbExecutor) {
    return getAgentProfileRow(projectId, id, executor)
}

export async function createAgentProfile(
    projectId: string,
    agent: string,
    name: string,
    config: AgentProfileConfig,
    executor?: DbExecutor,
): Promise<AgentProfile> {
    const id = `ap-${crypto.randomUUID()}`
    const now = new Date()
    await insertAgentProfile(
        {
            id,
            projectId,
            agent,
            name,
            configJson: JSON.stringify(config),
            createdAt: now,
            updatedAt: now,
        },
        executor,
    )
    const row = await getAgentProfile(projectId, id, executor)
    if (!row) throw new Error('Failed to create agent profile')
    return row
}

export async function updateAgentProfile(
    projectId: string,
    id: string,
    patch: Partial<{ name: string; config: AgentProfileConfig }>,
    executor?: DbExecutor,
) {
    const now = new Date()
    const updates: Parameters<typeof updateAgentProfileRow>[2] = {updatedAt: now}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.config !== undefined) updates.configJson = JSON.stringify(patch.config)
    await updateAgentProfileRow(projectId, id, updates, executor)
    return getAgentProfile(projectId, id, executor)
}

export async function deleteAgentProfile(projectId: string, id: string, executor?: DbExecutor) {
    await deleteAgentProfileRow(projectId, id, executor)
}
