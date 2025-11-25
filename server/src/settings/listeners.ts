import type {AppEventBus} from '../events/bus'
import {ensureAppSettings} from 'core'
import {log} from '../log'

export function registerSettingsListeners(bus: AppEventBus) {
    bus.subscribe('settings.global.updated', async () => {
        try {
            await ensureAppSettings()
        } catch (error) {
            log.error({err: error}, '[settings] failed to refresh cache on settings.global.updated')
        }
    })
}
