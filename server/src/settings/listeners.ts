import type {AppEventBus} from '../events/bus'
import {ensureAppSettings} from 'core'

export function registerSettingsListeners(bus: AppEventBus) {
    bus.subscribe('settings.global.updated', async () => {
        try {
            await ensureAppSettings()
        } catch (error) {
            console.error('[settings] failed to refresh cache on settings.global.updated', error)
        }
    })
}
