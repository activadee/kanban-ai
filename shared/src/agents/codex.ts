import type {AgentSandbox} from './public'

// Shape of a Codex agent profile's config
export type CodexProfile = {
    appendPrompt?: string | null
    /**
     * Optional prompt used only for inline responses (e.g. ticket enhancement).
     * Falls back to appendPrompt when empty or unset.
     */
    inlineProfile?: string | null
    sandbox?: AgentSandbox
    model?: string
    modelReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
    skipGitRepoCheck?: boolean
    networkAccessEnabled?: boolean
    webSearchEnabled?: boolean
    approvalPolicy?: 'never' | 'on-request' | 'on-failure' | 'untrusted'
    additionalDirectories?: string[]
    outputSchema?: unknown
    debug?: boolean
}

export const defaultCodexProfile: CodexProfile = {
    sandbox: 'workspace-write',
    skipGitRepoCheck: true,
    debug: false,
}
