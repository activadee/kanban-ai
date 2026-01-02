export interface TerminalInfo {
    id: string
    cardId: string
    projectId: string
    attemptId: string
    worktreePath: string
    cols: number
    rows: number
    shell: string
    createdAt: string
    clientCount: number
}

export interface TerminalListResponse {
    terminals: TerminalInfo[]
}

export interface EligibleTerminalCard {
    cardId: string
    attemptId: string
    worktreePath: string
    hasActiveTerminal: boolean
}

export interface EligibleCardsResponse {
    eligible: EligibleTerminalCard[]
}

export type TerminalInputMessage =
    | {type: 'data'; data: string}
    | {type: 'resize'; cols: number; rows: number}

export type TerminalOutputMessage =
    | {type: 'data'; data: string}
    | {type: 'exit'; code: number}
    | {type: 'error'; message: string}

export type TerminalCloseReason =
    | 'disconnect'
    | 'card_moved'
    | 'attempt_ended'
    | 'process_exit'
    | 'manual'
    | 'project_deleted'
