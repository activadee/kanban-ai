export type DroidProfile = {
    appendPrompt?: string | null
    autonomy?: 'read-only' | 'low' | 'medium' | 'high'
    model?: string
    reasoningEffort?: 'off' | 'low' | 'medium' | 'high'
    baseCommandOverride?: string | null
    additionalParams?: string[]
    debug?: boolean
}

export const defaultDroidProfile: DroidProfile = {autonomy: 'read-only', debug: false}
