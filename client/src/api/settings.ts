import type {AppSettingsResponse, UpdateAppSettingsRequest} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function getAppSettings(): Promise<AppSettingsResponse['settings']> {
    const res = await fetch(`${SERVER_URL}/settings`)
    const data = await parseApiResponse<AppSettingsResponse>(res)
    return data.settings
}

export async function patchAppSettings(update: UpdateAppSettingsRequest): Promise<AppSettingsResponse['settings']> {
    const res = await fetch(`${SERVER_URL}/settings`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(update),
    })
    const data = await parseApiResponse<AppSettingsResponse>(res)
    return data.settings
}
