export type ThemeMode = 'system' | 'light' | 'dark'
export type UiLanguage = 'browser' | 'en' | 'ja'

export type EditorType = 'VS_CODE' | 'WEBSTORM' | 'ZED' | 'ANTIGRAVITY'

export interface AppSettings {
    id: string
    // General
    theme: ThemeMode
    language: UiLanguage
    telemetryEnabled: boolean
    notificationsAgentCompletionSound: boolean
    notificationsDesktop: boolean
    autoStartAgentOnInProgress: boolean
    // Editor
    editorType: EditorType | null
    editorCommand: string | null
    // Git defaults
    gitUserName: string | null
    gitUserEmail: string | null
    branchTemplate: string
    // GitHub
    ghPrTitleTemplate: string | null
    ghPrBodyTemplate: string | null
    ghAutolinkTickets: boolean
    // OpenCode Agent
    opencodePort: number
    // Streamdown rendering (per message type)
    streamdownAssistantEnabled: boolean
    streamdownUserEnabled: boolean
    streamdownSystemEnabled: boolean
    streamdownThinkingEnabled: boolean
    createdAt: string
    updatedAt: string
}

export type UpdateAppSettingsRequest = Partial<
    Pick<
        AppSettings,
        | 'theme'
        | 'language'
        | 'telemetryEnabled'
        | 'notificationsAgentCompletionSound'
        | 'notificationsDesktop'
        | 'autoStartAgentOnInProgress'
        | 'editorType'
        | 'editorCommand'
        | 'gitUserName'
        | 'gitUserEmail'
        | 'branchTemplate'
        | 'ghPrTitleTemplate'
        | 'ghPrBodyTemplate'
        | 'ghAutolinkTickets'
        | 'opencodePort'
        | 'streamdownAssistantEnabled'
        | 'streamdownUserEnabled'
        | 'streamdownSystemEnabled'
        | 'streamdownThinkingEnabled'
    >
>

export type AppSettingsResponse = {
    settings: AppSettings
}
