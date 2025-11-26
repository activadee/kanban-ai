export interface SettingsGlobalUpdatedEvent {
    changes: Record<string, unknown>
    updatedAt: string
}

export type SettingsEventMap = {
    'settings.global.updated': SettingsGlobalUpdatedEvent
}
