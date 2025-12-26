import type {ConversationItem} from './conversation'

export type AttemptStatus = 'queued' | 'running' | 'stopping' | 'succeeded' | 'failed' | 'stopped'

// Dynamic registry-based agent keys
export type AgentKey = string

export type CreateAttemptRequest = {
    agent: AgentKey
    baseBranch?: string
    branchName?: string
    profileId?: string
    isPlanningAttempt?: boolean
}

export type Attempt = {
    id: string
    cardId: string
    boardId: string
    agent: AgentKey | string
    status: AttemptStatus
    baseBranch: string
    branchName: string
    isPlanningAttempt?: boolean
    worktreePath: string | null
    sessionId?: string | null
    startedAt?: string | null
    endedAt?: string | null
    createdAt: string
    updatedAt: string
}

export type AttemptLog = {
    id: string
    attemptId: string
    ts: string
    level: 'info' | 'warn' | 'error'
    message: string
}

export type AttemptConversationItem = ConversationItem & { attemptId: string }

// WS messages extension for attempts
export type WsAttemptMsg =
    | { type: 'attempt_status'; payload: { attemptId: string; status: AttemptStatus } }
    | {
    type: 'attempt_log';
    payload: { attemptId: string; level: 'info' | 'warn' | 'error'; message: string; ts: string }
}
    | { type: 'conversation_item'; payload: { attemptId: string; item: ConversationItem } }
    | { type: 'attempt_session'; payload: { attemptId: string; sessionId: string } }
