export type ProjectId = string
export type BoardId = string

export type ProjectStatus = 'Active' | 'Paused'

// Inline agents represent logical inline workflows (e.g. ticket
// enhancement vs PR inline summary) that can each have their own
// profile mapping.
export type InlineAgentId = 'ticketEnhance' | 'prSummary' | 'prReview'

export type InlineAgentProfileMapping = Partial<Record<InlineAgentId, string | null>>

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
    /**
     * Global toggle: when true, failures from any automation stage
     * (copy/setup/dev/cleanup) are treated as warnings. Startup stages won't
     * block agent execution.
     */
    allowScriptsToFail: boolean
    /**
     * Per-script overrides. When true, failures for that script are treated as warnings
     * even if the global toggle is off.
     */
    allowCopyFilesToFail: boolean
    allowSetupScriptToFail: boolean
    allowDevScriptToFail: boolean
    allowCleanupScriptToFail: boolean
    defaultAgent: string | null
    defaultProfileId: string | null
    inlineAgent: string | null
    inlineProfileId: string | null
    /**
     * Optional per-inline-agent profile overrides. When a mapping entry is null
     * or absent, the inline pipeline falls back to the project’s inline/default
     * profile configuration and ultimately the agent’s default profile.
     */
    inlineAgentProfileMapping: InlineAgentProfileMapping
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
    allowScriptsToFail?: boolean
    allowCopyFilesToFail?: boolean
    allowSetupScriptToFail?: boolean
    allowDevScriptToFail?: boolean
    allowCleanupScriptToFail?: boolean
    defaultAgent?: string | null
    defaultProfileId?: string | null
    inlineAgent?: string | null
    inlineProfileId?: string | null
    inlineAgentProfileMapping?: InlineAgentProfileMapping
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
