import type {z} from 'zod'
import type {ConversationItem} from 'shared'

export type AgentCapabilities = {
    resume?: boolean
    mcp?: boolean
    sandbox?: 'auto' | 'read-only' | 'workspace-write' | 'danger-full-access'
}

export type AgentContext = {
    attemptId: string
    boardId: string
    cardId: string
    worktreePath: string
    repositoryPath: string
    branchName: string
    baseBranch: string
    cardTitle: string
    cardDescription?: string | null
    profileId?: string | null
    sessionId?: string
    followupPrompt?: string
    signal: AbortSignal
    emit: (
        event:
            | { type: 'log'; level?: 'info' | 'warn' | 'error'; message: string }
            | { type: 'status'; status: string }
            | { type: 'session'; id: string }
            | { type: 'conversation'; item: ConversationItem }
    ) => void
}

export type TicketEnhanceInput = {
    projectId: string
    boardId: string
    repositoryPath: string
    baseBranch: string
    title: string
    description: string
    profileId?: string | null
    signal: AbortSignal
}

export type TicketEnhanceResult = {
    title: string
    description: string
}

export type AgentProfileUnknown = unknown

export type AgentInfo<P = AgentProfileUnknown> = {
    key: string
    label: string
    defaultProfile: P
    profileSchema: z.ZodType<P>
    capabilities?: AgentCapabilities
    availability?: () => Promise<boolean>
}

export interface Agent<P = AgentProfileUnknown> extends AgentInfo<P> {
    run(ctx: AgentContext, profile: P): Promise<number>

    resume?: (ctx: AgentContext, profile: P) => Promise<number>

    enhance?: (input: TicketEnhanceInput, profile: P) => Promise<TicketEnhanceResult>
}
