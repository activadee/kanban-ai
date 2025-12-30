import {getAgentProfilesGlobalRepo} from '../repos/provider'
import type {AgentProfileGlobalRow, AgentProfileGlobalInsert} from '../db/types'
import type {AgentProfileGlobalUpdate} from '../repos/interfaces'

export type GlobalAgentProfileInsert = AgentProfileGlobalInsert
export type GlobalAgentProfileUpdate = AgentProfileGlobalUpdate

export async function listGlobalAgentProfiles(): Promise<AgentProfileGlobalRow[]> {
    return getAgentProfilesGlobalRepo().listGlobalAgentProfiles()
}

export async function getGlobalAgentProfile(id: string): Promise<AgentProfileGlobalRow | null> {
    return getAgentProfilesGlobalRepo().getGlobalAgentProfile(id)
}

export async function insertGlobalAgentProfile(values: GlobalAgentProfileInsert): Promise<void> {
    return getAgentProfilesGlobalRepo().insertGlobalAgentProfile(values)
}

export async function updateGlobalAgentProfileRow(id: string, patch: GlobalAgentProfileUpdate): Promise<void> {
    return getAgentProfilesGlobalRepo().updateGlobalAgentProfileRow(id, patch)
}

export async function deleteGlobalAgentProfile(id: string): Promise<void> {
    return getAgentProfilesGlobalRepo().deleteGlobalAgentProfile(id)
}
