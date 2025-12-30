export type DroidProfile = {
    appendPrompt?: string | null
    inlineProfile?: string | null
    model?: string
    autonomyLevel?: 'default' | 'low' | 'medium' | 'high'
    reasoningEffort?: 'off' | 'none' | 'low' | 'medium' | 'high'
    useSpec?: boolean
    specModel?: string
    specReasoningEffort?: 'off' | 'none' | 'low' | 'medium' | 'high'
    enabledTools?: string[]
    disabledTools?: string[]
    skipPermissionsUnsafe?: boolean
    baseCommandOverride?: string | null
    debug?: boolean
}

export const defaultDroidProfile: DroidProfile = {debug: false}
