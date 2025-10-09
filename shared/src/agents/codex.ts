import type {AgentSandbox} from './public'

// Shape of a Codex agent profile's config
export type CodexProfile = {
    appendPrompt?: string | null
    sandbox?: AgentSandbox
    oss?: boolean
    model?: string
    modelReasoningEffort?: 'low' | 'medium' | 'high'
    modelReasoningSummary?: 'auto' | 'concise' | 'detailed' | 'none'
    baseCommandOverride?: string | null
    additionalParams?: string[]
    debug?: boolean
}

export const defaultCodexProfile: CodexProfile = {sandbox: 'auto', oss: false, debug: false}

