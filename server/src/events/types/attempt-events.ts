import type {AttemptStatus, ConversationItem, AttemptTodoSummary} from 'shared'

export interface AttemptQueuedEvent {
    attemptId: string
    boardId: string
    cardId: string
    agent: string
    branchName: string
    baseBranch: string
    profileId?: string
}

export interface AttemptStartedEvent {
    attemptId: string
    boardId: string
    cardId: string
    agent: string
    branchName: string
    baseBranch: string
    worktreePath: string
    profileId?: string
}

export interface AttemptStatusChangedEvent {
    attemptId: string
    boardId: string
    status: AttemptStatus
    previousStatus?: AttemptStatus
    endedAt?: string | null
}

export interface AttemptLogAppendedEvent {
    attemptId: string
    boardId: string
    level: 'info' | 'warn' | 'error'
    message: string
    ts: string
}

export interface AttemptConversationAppendedEvent {
    attemptId: string
    boardId: string
    item: ConversationItem
}

export interface AttemptSessionRecordedEvent {
    attemptId: string
    boardId: string
    sessionId: string
}

export interface AttemptTodosUpdatedEvent {
    attemptId: string
    boardId: string
    todos: AttemptTodoSummary
}

export interface AttemptCompletedEvent {
    attemptId: string
    boardId: string
    cardId: string
    status: AttemptStatus
    worktreePath: string
    profileId?: string
}

export interface AttemptAutocommitRequestedEvent {
    attemptId: string
    boardId: string
    worktreePath: string
    cardId: string
    profileId?: string
    autoPushOnAutocommit?: boolean
    preferredRemote?: string | null
}

export interface AttemptStoppedEvent {
    attemptId: string
    boardId: string
    reason?: string
}

export type AttemptEventMap = {
    'attempt.queued': AttemptQueuedEvent
    'attempt.started': AttemptStartedEvent
    'attempt.status.changed': AttemptStatusChangedEvent
    'attempt.log.appended': AttemptLogAppendedEvent
    'attempt.conversation.appended': AttemptConversationAppendedEvent
    'attempt.session.recorded': AttemptSessionRecordedEvent
    'attempt.todos.updated': AttemptTodosUpdatedEvent
    'attempt.completed': AttemptCompletedEvent
    'attempt.autocommit.requested': AttemptAutocommitRequestedEvent
    'attempt.stopped': AttemptStoppedEvent
}
