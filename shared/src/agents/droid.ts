export type DroidProfile = {
    appendPrompt?: string | null
    /**
     * Optional prompt used only for inline responses (e.g. ticket enhancement).
     * Falls back to appendPrompt when empty or unset.
     */
    inlineProfile?: string | null
    autonomy?: 'read-only' | 'low' | 'medium' | 'high'
    model?: string
    reasoningEffort?: 'off' | 'low' | 'medium' | 'high'
    baseCommandOverride?: string | null
    additionalParams?: string[]
    debug?: boolean
}

export const defaultDroidProfile: DroidProfile = {autonomy: 'read-only', debug: false}
