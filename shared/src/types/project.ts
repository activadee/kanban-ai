export type ProjectStatus = 'Active' | 'Paused'

export interface ProjectSummary {
    id: string
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
    projectId: string
    baseBranch: string
    preferredRemote: string | null
    setupScript: string | null
    devScript: string | null
    cleanupScript: string | null
    copyFiles: string | null
    defaultAgent: string | null
    defaultProfileId: string | null
    autoCommitOnFinish: boolean
    ticketPrefix: string
    nextTicketNumber: number
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
    autoCommitOnFinish?: boolean
    ticketPrefix?: string
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
