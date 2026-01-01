import type {AgentContext, PrSummaryInlineInput, TicketEnhanceInput} from '../types'

type LogLevel = 'info' | 'warn' | 'error'

/**
 * Default emit function that logs to console.
 * Used for inline tasks that don't have a real event emitter.
 */
export function createConsoleEmit(): AgentContext['emit'] {
    return (event) => {
        if (event.type === 'log') {
            const level = event.level ?? 'info'
            const message = event.message
            if (level === 'error') {
                console.error(message)
            } else if (level === 'warn') {
                console.warn(message)
            } else {
                console.info(message)
            }
        }
    }
}

/**
 * No-op emit function for silent inline operations.
 */
export const silentEmit: AgentContext['emit'] = () => {}

/**
 * Creates an AgentContext for ticket enhancement inline tasks.
 */
export function createEnhanceContext(
    input: TicketEnhanceInput,
    emit?: AgentContext['emit'],
): AgentContext {
    return {
        attemptId: `enhance-${input.projectId}`,
        boardId: input.boardId,
        cardId: 'ticket',
        worktreePath: input.repositoryPath,
        repositoryPath: input.repositoryPath,
        branchName: input.baseBranch,
        baseBranch: input.baseBranch,
        cardTitle: input.title,
        cardDescription: input.description,
        ticketType: input.ticketType ?? null,
        profileId: input.profileId ?? null,
        sessionId: undefined,
        followupPrompt: undefined,
        signal: input.signal,
        emit: emit ?? silentEmit,
    }
}

/**
 * Creates an AgentContext for PR summary inline tasks.
 */
export function createPrSummaryContext(
    input: PrSummaryInlineInput,
    signal?: AbortSignal,
    emit?: AgentContext['emit'],
): AgentContext {
    return {
        attemptId: `pr-summary-${input.repositoryPath}`,
        boardId: 'pr-summary',
        cardId: 'pr',
        worktreePath: input.repositoryPath,
        repositoryPath: input.repositoryPath,
        branchName: input.headBranch,
        baseBranch: input.baseBranch,
        cardTitle: `PR from ${input.headBranch} into ${input.baseBranch}`,
        cardDescription: undefined,
        ticketType: null,
        profileId: null,
        sessionId: undefined,
        followupPrompt: undefined,
        signal: signal ?? new AbortController().signal,
        emit: emit ?? silentEmit,
    }
}
