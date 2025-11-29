import type {z} from 'zod'
import type {ConversationItem, AttemptTodoSummary} from 'shared'

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
            | { type: 'todo'; todos: AttemptTodoSummary }
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

// Generic inline task model

export type InlineTaskKind = 'ticketEnhance' | 'prSummary' | 'prReview'

export type InlineTaskContext = {
    projectId: string
    boardId: string
    repositoryPath: string
    baseBranch: string
    /**
     * Optional branch name the inline task is scoped to (e.g. PR head).
     */
    branchName?: string | null
    /**
     * Optional HEAD commit SHA for the inline task (if applicable).
     */
    headCommit?: string | null
    /**
     * Agent key used for the task (e.g. CODEX, DROID).
     */
    agentKey: string
    /**
     * Effective profileId, if any, used to resolve the agent profile.
     */
    profileId?: string | null
    /**
     * Source of the prompt/profile used for the inline task.
     * "inline" = specialized inline profile, "primary" = main agent profile.
     */
    profileSource?: 'inline' | 'primary'
}

// Placeholder shapes for future inline kinds. These will be refined when
// PR summary / review features are implemented.

export type PrSummaryInlineInput = {
    repositoryPath: string
    baseBranch: string
    headBranch: string
}

export type PrSummaryInlineResult = {
    summary: string
}

export type PrReviewInlineInput = {
    repositoryPath: string
    baseBranch: string
    headBranch: string
}

export type PrReviewInlineResult = {
    review: string
}

export type InlineTaskInputByKind = {
    ticketEnhance: TicketEnhanceInput
    prSummary: PrSummaryInlineInput
    prReview: PrReviewInlineInput
}

export type InlineTaskResultByKind = {
    ticketEnhance: TicketEnhanceResult
    prSummary: PrSummaryInlineResult
    prReview: PrReviewInlineResult
}

export type InlineTaskErrorCode = 'UNKNOWN_AGENT' | 'AGENT_NO_INLINE' | 'INLINE_TASK_FAILED' | 'ABORTED'

export class InlineTaskError extends Error {
    readonly kind: InlineTaskKind
    readonly agent: string
    readonly code: InlineTaskErrorCode
    readonly cause?: unknown

    constructor(params: {kind: InlineTaskKind; agent: string; code: InlineTaskErrorCode; message: string; cause?: unknown}) {
        super(params.message)
        this.name = 'InlineTaskError'
        this.kind = params.kind
        this.agent = params.agent
        this.code = params.code
        this.cause = params.cause
    }
}

export function isInlineTaskError(err: unknown): err is InlineTaskError {
    return err instanceof InlineTaskError
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

    inline?: <K extends InlineTaskKind>(
        kind: K,
        input: InlineTaskInputByKind[K],
        profile: P,
        opts?: {context: InlineTaskContext; signal?: AbortSignal},
    ) => Promise<InlineTaskResultByKind[K]>
}
