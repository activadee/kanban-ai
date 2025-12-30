import {getProjectSettingsRepo} from '../../repos/provider'
import type {ProjectSettingsRow, ProjectSettingsInsert} from '../../db/types'
import type {ProjectSettingsUpdate} from '../../repos/interfaces'

export type {ProjectSettingsInsert, ProjectSettingsUpdate}

export async function getProjectSettingsRow(projectId: string): Promise<ProjectSettingsRow | null> {
    return getProjectSettingsRepo().getProjectSettingsRow(projectId)
}

export async function insertProjectSettings(values: ProjectSettingsInsert): Promise<void> {
    return getProjectSettingsRepo().insertProjectSettings(values)
}

export async function updateProjectSettingsRow(projectId: string, patch: ProjectSettingsUpdate): Promise<void> {
    return getProjectSettingsRepo().updateProjectSettingsRow(projectId, patch)
}
