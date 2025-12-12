export type ConversationTextFormat = 'markdown' | 'plaintext'

export type ConversationRole = 'user' | 'assistant' | 'system'

export type AutomationStage = 'copy_files' | 'setup' | 'dev' | 'cleanup'

export type AutomationStatus = 'running' | 'succeeded' | 'failed'

export interface ConversationItemBase {
    /**
     * Optional stable identifier assigned by the server when persisted.
     */
    id?: string
    /** ISO8601 timestamp. */
    timestamp: string
}

export type ConversationMessageItem = ConversationItemBase & {
    type: 'message'
    role: ConversationRole
    text: string
    format?: ConversationTextFormat
    /**
     * When applicable, indicates which profile was used to produce the message.
     */
    profileId?: string | null
}

export type ConversationThinkingItem = ConversationItemBase & {
    type: 'thinking'
    title?: string | null
    text: string
    format?: ConversationTextFormat
}

export type ConversationToolStatus = 'created' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface ConversationToolInvocation {
    name: string
    action?: string | null
    command?: string | null
    cwd?: string | null
    status: ConversationToolStatus
    startedAt?: string | null
    completedAt?: string | null
    durationMs?: number | null
    exitCode?: number | null
    stdout?: string | null
    stderr?: string | null
    metadata?: Record<string, unknown>
}

export type ConversationToolItem = ConversationItemBase & {
    type: 'tool'
    tool: ConversationToolInvocation
}

export type ConversationErrorItem = ConversationItemBase & {
    type: 'error'
    text: string
    details?: Record<string, unknown>
}

export type ConversationAutomationItem = ConversationItemBase & {
    type: 'automation'
    stage: AutomationStage
    command: string
    cwd: string
    status: AutomationStatus
    /**
     * When true, a failed automation stage was allowed to fail (treated as warning).
     */
    allowedFailure?: boolean
    startedAt: string
    completedAt: string
    durationMs: number
    exitCode: number | null
    stdout?: string | null
    stderr?: string | null
    metadata?: Record<string, unknown>
}

export type ConversationItem =
    | ConversationMessageItem
    | ConversationThinkingItem
    | ConversationToolItem
    | ConversationErrorItem
    | ConversationAutomationItem
