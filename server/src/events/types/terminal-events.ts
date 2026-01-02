import type {TerminalCloseReason} from 'shared'

export interface TerminalEventMap {
    'terminal.opened': {
        projectId: string
        cardId: string
        attemptId: string
        worktreePath: string
    }

    'terminal.closed': {
        projectId: string
        cardId: string
        reason: TerminalCloseReason
    }
}
