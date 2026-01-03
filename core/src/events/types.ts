import type {
    BoardState,
    ConversationItem,
    AttemptStatus,
    FileChange,
    PRInfo,
    AttemptTodoSummary,
    TicketType,
} from 'shared'

export interface ProjectCreatedEvent {
    projectId: string
    name: string
    repositoryPath: string
    repositoryUrl?: string | null
    repositorySlug?: string | null
    createdAt: string
}

export interface ProjectUpdatedEvent {
    projectId: string
    changes: Partial<{
        name: string
        repositoryPath: string
        repositoryUrl: string | null
        repositorySlug: string | null
    }>
    updatedAt: string
}

export interface ProjectDeletedEvent {
    projectId: string
    projectName?: string | null
    /**
     * Absolute path to the Git repository backing this project.
     * Used by filesystem listeners to prune stale worktrees on project deletion.
     */
    repositoryPath?: string | null
}

export interface ProjectSettingsUpdatedEvent {
    projectId: string
    changes: Record<string, unknown>
    updatedAt: string
}

export interface BoardStateChangedEvent {
    boardId: string
    state: BoardState
    reason?: string
}

export interface CardCreatedEvent {
    boardId: string
    columnId: string
    cardId: string
}

export interface CardUpdatedEvent {
    boardId: string
    cardId: string
    changes: Partial<{
        title: string
        description: string | null
        ticketKey: string | null
        ticketType: TicketType | null
        isEnhanced: boolean
        disableAutoCloseOnPRMerge: boolean
    }>
}

export interface CardMovedEvent {
    boardId: string
    cardId: string
    fromColumnId: string
    toColumnId: string
    toIndex: number
}

export interface CardDeletedEvent {
    boardId: string
    cardId: string
    columnId: string
}

export interface BoardColumnsInitializedEvent {
    boardId: string
    columnIds: string[]
}

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
    cardId?: string
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

export interface WorktreeCreatedEvent {
    projectId: string
    attemptId: string
    path: string
    branchName: string
    baseBranch: string
}

export interface WorktreeRemovedEvent {
    projectId: string
    attemptId: string
    path: string
}

export interface GitStatusChangedEvent {
    projectId: string
    files?: FileChange[]
}

export interface GitCommitCreatedEvent {
    projectId: string
    attemptId?: string
    shortSha: string
    subject: string
    ts: string
}

export interface GitPushCompletedEvent {
    projectId: string
    attemptId?: string
    remote: string
    branch: string
    ts: string
}

export interface GitMergeCompletedEvent {
    projectId: string
    attemptId?: string
    result: {
        merged: boolean
        message: string
    }
}

export interface GitRebaseStartedEvent {
    projectId: string
    attemptId?: string
    ts: string
}

export interface GitRebaseCompletedEvent {
    projectId: string
    attemptId?: string
    ts: string
}

export interface GitRebaseAbortedEvent {
    projectId: string
    attemptId?: string
    reason: string
    ts: string
}

export interface GitPushRetriedEvent {
    projectId: string
    attemptId?: string
    remote: string
    branch: string
    ts: string
}

export interface GithubConnectedEvent {
    provider: 'device_flow'
    connectedAt: string
}

export interface GithubDisconnectedEvent {
    disconnectedAt: string
}

export interface GithubPrCreatedEvent {
    projectId: string
    attemptId?: string
    pr: PRInfo
}

export interface GithubIssuesImportedEvent {
    projectId: string
    importedCount: number
}

export interface AgentRegisteredEvent {
    agent: string
    label?: string
}

export interface SettingsGlobalUpdatedEvent {
    changes: Record<string, unknown>
    updatedAt: string
}

export interface EditorOpenRequestedEvent {
    path: string
    editorCommand?: string | null
    attemptId?: string
    projectId?: string
}

export interface EditorOpenSucceededEvent {
    path: string
    editorCommand?: string | null
    pid?: number
}

export interface EditorOpenFailedEvent {
    path: string
    editorCommand?: string | null
    error: string
}

export interface AgentProfileChangedEvent {
    profileId: string
    agent: string
    kind: 'created' | 'updated' | 'deleted'
    label?: string
}

export type AppEventMap = {
    'project.created': ProjectCreatedEvent
    'project.updated': ProjectUpdatedEvent
    'project.deleted': ProjectDeletedEvent
    'project.settings.updated': ProjectSettingsUpdatedEvent
    'board.state.changed': BoardStateChangedEvent
    'board.columns.initialized': BoardColumnsInitializedEvent
    'card.created': CardCreatedEvent
    'card.updated': CardUpdatedEvent
    'card.moved': CardMovedEvent
    'card.deleted': CardDeletedEvent
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
    'worktree.created': WorktreeCreatedEvent
    'worktree.removed': WorktreeRemovedEvent
    'git.status.changed': GitStatusChangedEvent
    'git.commit.created': GitCommitCreatedEvent
    'git.push.completed': GitPushCompletedEvent
    'git.merge.completed': GitMergeCompletedEvent
    'git.rebase.started': GitRebaseStartedEvent
    'git.rebase.completed': GitRebaseCompletedEvent
    'git.rebase.aborted': GitRebaseAbortedEvent
    'git.push.retried': GitPushRetriedEvent
    'github.connected': GithubConnectedEvent
    'github.disconnected': GithubDisconnectedEvent
    'github.pr.created': GithubPrCreatedEvent
    'github.issues.imported': GithubIssuesImportedEvent
    'settings.global.updated': SettingsGlobalUpdatedEvent
    'editor.open.requested': EditorOpenRequestedEvent
    'editor.open.succeeded': EditorOpenSucceededEvent
    'editor.open.failed': EditorOpenFailedEvent
    'agent.profile.changed': AgentProfileChangedEvent
    'agent.registered': AgentRegisteredEvent
}

export type AppEventName = keyof AppEventMap
export type AppEventPayload<Name extends AppEventName> = AppEventMap[Name]

export type AppEvent<Name extends AppEventName = AppEventName> = {
    name: Name
    payload: AppEventPayload<Name>
}

export type AppEventHandler<Name extends AppEventName> = (payload: AppEventPayload<Name>) => void | Promise<void>
