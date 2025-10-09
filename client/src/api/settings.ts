import type {AppSettingsResponse, UpdateAppSettingsRequest} from 'shared'
import {SERVER_URL} from '@/lib/env'

export async function getAppSettings(): Promise<AppSettingsResponse['settings']> {
    const res = await fetch(`${SERVER_URL}/settings`)
    if (!res.ok) throw new Error('Failed to load settings')
    const data = (await res.json()) as AppSettingsResponse
    return data.settings
}

export async function patchAppSettings(update: UpdateAppSettingsRequest): Promise<AppSettingsResponse['settings']> {
    const res = await fetch(`${SERVER_URL}/settings`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(update),
    })
    if (!res.ok) throw new Error('Failed to update settings')
    const data = (await res.json()) as AppSettingsResponse
    return data.settings
}
