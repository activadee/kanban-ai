import {getAgentProfilesRepo} from '../repos/provider'
import type {AgentProfileRow, AgentProfileInsert} from '../db/types'
import type {AgentProfileUpdate} from '../repos/interfaces'

export type {AgentProfileInsert, AgentProfileUpdate}

export async function listAgentProfiles(projectId: string): Promise<AgentProfileRow[]> {
    return getAgentProfilesRepo().listAgentProfiles(projectId)
}

export async function getAgentProfile(projectId: string, id: string): Promise<AgentProfileRow | null> {
    return getAgentProfilesRepo().getAgentProfile(projectId, id)
}

export async function insertAgentProfile(values: AgentProfileInsert): Promise<void> {
    return getAgentProfilesRepo().insertAgentProfile(values)
}

export async function updateAgentProfileRow(projectId: string, id: string, patch: AgentProfileUpdate): Promise<void> {
    return getAgentProfilesRepo().updateAgentProfileRow(projectId, id, patch)
}

export async function deleteAgentProfile(projectId: string, id: string): Promise<void> {
    return getAgentProfilesRepo().deleteAgentProfile(projectId, id)
}
