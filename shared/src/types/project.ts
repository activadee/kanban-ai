export type ProjectId = string
export type BoardId = string

export type ProjectStatus = 'Active' | 'Paused'

export interface ProjectSummary {
    id: ProjectId
    boardId: BoardId
    name: string
    status: ProjectStatus
    createdAt: string
    repositoryPath: string
    repositoryUrl: string | null
    repositorySlug: string | null
}

export interface CreateProjectRequest {
    name: string
    repositoryPath: string
    initialize?: boolean
    repositorySlug?: string | null
    repositoryUrl?: string | null
}

export interface UpdateProjectRequest {
    name?: string
}

export interface ProjectSettings {
    projectId: ProjectId
    boardId: BoardId
    baseBranch: string
    preferredRemote: string | null
    setupScript: string | null
    devScript: string | null
    cleanupScript: string | null
    copyFiles: string | null
    defaultAgent: string | null
    defaultProfileId: string | null
    inlineAgent: string | null
    inlineProfileId: string | null
    autoCommitOnFinish: boolean
    autoPushOnAutocommit: boolean
    ticketPrefix: string
    nextTicketNumber: number
    githubIssueSyncEnabled: boolean
    githubIssueSyncState: 'open' | 'all' | 'closed'
    githubIssueSyncIntervalMinutes: number
    lastGithubIssueSyncAt: string | null
    lastGithubIssueSyncStatus: 'idle' | 'running' | 'succeeded' | 'failed'
    createdAt: string
    updatedAt: string
}

export interface UpdateProjectSettingsRequest {
    baseBranch?: string
    preferredRemote?: string | null
    setupScript?: string | null
    devScript?: string | null
    cleanupScript?: string | null
    copyFiles?: string | null
    defaultAgent?: string | null
    defaultProfileId?: string | null
    inlineAgent?: string | null
    inlineProfileId?: string | null
    autoCommitOnFinish?: boolean
    autoPushOnAutocommit?: boolean
    ticketPrefix?: string
    githubIssueSyncEnabled?: boolean
    githubIssueSyncState?: 'open' | 'all' | 'closed'
    githubIssueSyncIntervalMinutes?: number
}

export type ProjectSettingsResponse = {
    settings: ProjectSettings
}

export type ProjectBranchKind = 'local' | 'remote'

export type ProjectBranchInfo = {
    name: string
    displayName: string
    kind: ProjectBranchKind
    remote?: string
    isCurrent: boolean
}

export type TicketKeyPreview = {
    key: string
    prefix: string
    number: number
}
