import type {AgentSandbox} from './public'

// Shape of a Codex agent profile's config
export type CodexProfile = {
    appendPrompt?: string | null
    sandbox?: AgentSandbox
    model?: string
    modelReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
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
