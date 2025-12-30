import {getAppSettingsRepo} from '../repos/provider'
import type {AppSettingsRow} from '../db/types'

export async function getAppSettingsRow(): Promise<AppSettingsRow | null> {
    return getAppSettingsRepo().getAppSettingsRow()
}

export async function insertDefaultAppSettings(): Promise<void> {
    return getAppSettingsRepo().insertDefaultAppSettings()
}

export async function updateAppSettingsRow(values: Partial<AppSettingsRow>): Promise<void> {
    return getAppSettingsRepo().updateAppSettingsRow(values)
}
