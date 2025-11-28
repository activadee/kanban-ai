import type {
    CreateProjectRequest,
    ProjectSettings,
    ProjectSummary,
    ProjectBranchInfo,
    UpdateProjectRequest,
    ImportIssuesRequest,
    ImportIssuesResponse,
    GitOriginResponse,
    TicketKeyPreview,
} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export type EnhanceTicketRequestParams = {
    projectId: string
    title: string
    description?: string
    agent?: string
    profileId?: string
}

export type EnhanceTicketResponse = {
    ticket: {
        title: string
        description: string
    }
}

export async function listProjects(): Promise<ProjectSummary[]> {
    const res = await fetch(`${SERVER_URL}/projects`)
    return parseApiResponse<ProjectSummary[]>(res)
}

export async function getProject(projectId: string): Promise<ProjectSummary> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}`)
    return parseApiResponse<ProjectSummary>(res)
}

export async function createProject(payload: CreateProjectRequest): Promise<ProjectSummary> {
    const res = await fetch(`${SERVER_URL}/projects`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseApiResponse<ProjectSummary>(res)
}

export async function updateProjectName(projectId: string, update: UpdateProjectRequest): Promise<ProjectSummary> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(update),
    })
    return parseApiResponse<ProjectSummary>(res)
}

export async function deleteProjectById(projectId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}`, {method: 'DELETE'})
    await parseApiResponse(res)
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettings> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/settings`)
    const data = await parseApiResponse<{ settings: ProjectSettings }>(res)
    return data.settings
}

export async function updateProjectSettings(projectId: string, updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates),
    })
    const data = await parseApiResponse<{ settings: ProjectSettings }>(res)
    return data.settings
}

export async function listProjectBranches(projectId: string): Promise<ProjectBranchInfo[]> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/git/branches`)
    const data = await parseApiResponse<{ branches: ProjectBranchInfo[] }>(res)
    return data.branches
}

export async function getNextTicketKey(projectId: string): Promise<TicketKeyPreview> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/tickets/next-key`)
    const data = await parseApiResponse<{ preview: TicketKeyPreview }>(res)
    return data.preview
}

export async function getProjectGithubOrigin(projectId: string): Promise<GitOriginResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/github/origin`)
    return parseApiResponse<GitOriginResponse>(res)
}

export async function importGithubIssues(boardId: string, payload: ImportIssuesRequest): Promise<ImportIssuesResponse> {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/import/github/issues`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseApiResponse<ImportIssuesResponse>(res)
}

export async function enhanceTicketRequest(params: EnhanceTicketRequestParams): Promise<EnhanceTicketResponse> {
    const {projectId, title, description, agent, profileId} = params

    const res = await fetch(`${SERVER_URL}/projects/${projectId}/tickets/enhance`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            title,
            description,
            agent,
            profileId,
        }),
    })

    return parseApiResponse<EnhanceTicketResponse>(res)
}
