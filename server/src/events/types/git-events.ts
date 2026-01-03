import type {FileChange, PRInfo} from 'shared'

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

export interface GithubPrMergedAutoClosedEvent {
    projectId: string
    boardId: string
    cardId: string
    prNumber: number
    prUrl: string
    ts: string
}

export interface GithubIssueClosedAutoClosedEvent {
    projectId: string
    boardId: string
    cardId: string
    issueNumber: number
    issueUrl: string
    ts: string
}

export interface GitRebaseStartedEvent {
    projectId: string
    attemptId: string
    ts: string
}

export interface GitRebaseCompletedEvent {
    projectId: string
    attemptId: string
    ts: string
}

export interface GitRebaseAbortedEvent {
    projectId: string
    attemptId: string
    reason: string
    ts: string
}

export interface GitPushRetriedEvent {
    projectId: string
    attemptId: string
    remote: string
    branch: string
    ts: string
}

export type GitEventMap = {
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
    'github.pr.merged.autoClosed': GithubPrMergedAutoClosedEvent
    'github.issue.closed.autoClosed': GithubIssueClosedAutoClosedEvent
}
