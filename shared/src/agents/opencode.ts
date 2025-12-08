export type OpencodeProfile = {
    appendPrompt?: string | null
    /**
     * Optional prompt used only for inline responses (e.g. ticket enhancement).
     * Falls back to appendPrompt when empty or unset.
     */
    inlineProfile?: string | null
    /**
     * Optional OpenCode agent key to use for this profile
     * (e.g. "plan", "build", "general"). When unset, the
     * server-side default agent is used.
     */
    agent?: string
    /**
     * Optional model identifier in the form
     * "provider/model", for example
     * "anthropic/claude-3-5-sonnet-20241022".
     */
    model?: string
    /**
     * Optional API base URL for a remote OpenCode server.
     * When unset, the SDK will start a local `opencode serve`
     * instance instead.
     */
    baseUrl?: string | null
    /**
     * Optional API key used when talking to a remote
     * OpenCode server. This mirrors the OPENCODE_API_KEY
     * environment variable. When unset, remote mode is
     * disabled and a local server is used instead.
     */
    apiKey?: string | null
    debug?: boolean
}

export const defaultOpencodeProfile: OpencodeProfile = {
    debug: false,
}
