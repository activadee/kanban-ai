export type OpencodeProfile = {
    appendPrompt?: string | null
    /**
     * Optional prompt used only for inline responses (e.g. ticket enhancement).
     * Falls back to appendPrompt when empty or unset.
     */
    inlineProfile?: string | null
    agent?: string
    model?: string
    baseCommandOverride?: string | null
    additionalParams?: string[]
    debug?: boolean
}

export const defaultOpencodeProfile: OpencodeProfile = {
    debug: false,
}
