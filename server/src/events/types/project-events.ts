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
}

export interface ProjectSettingsUpdatedEvent {
    projectId: string
    changes: Record<string, unknown>
    updatedAt: string
}

export type ProjectEventMap = {
    'project.created': ProjectCreatedEvent
    'project.updated': ProjectUpdatedEvent
    'project.deleted': ProjectDeletedEvent
    'project.settings.updated': ProjectSettingsUpdatedEvent
}
