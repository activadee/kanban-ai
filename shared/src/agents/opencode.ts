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
     * Optional API key mirrored into OPENCODE_API_KEY
     * when starting a local OpenCode server. Ignored
     * when connecting to an already-running remote
     * server via baseUrl.
     */
    apiKey?: string | null
    /**
     * Optional port number for the local OpenCode server.
     * Must be between 1 and 65535. Default is 4097.
     * When a server is already running on the specified port,
     * it will be reused instead of starting a new instance.
     */
    port?: number | null
    debug?: boolean
}

export const defaultOpencodeProfile: OpencodeProfile = {
    debug: false,
    port: 4097,
}
