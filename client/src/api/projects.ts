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

async function parseJson<T>(response: Response): Promise<T> {
    const text = await response.text()
    let data: unknown = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        // ignore JSON parse failure
    }
    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data ? (data as { error?: string }).error : null
        throw new Error(message || `Request failed with status ${response.status}`)
    }
    return data as T
}

export async function listProjects(): Promise<ProjectSummary[]> {
    const res = await fetch(`${SERVER_URL}/projects`)
    return parseJson<ProjectSummary[]>(res)
}

export async function getProject(projectId: string): Promise<ProjectSummary> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}`)
    return parseJson<ProjectSummary>(res)
}

export async function createProject(payload: CreateProjectRequest): Promise<ProjectSummary> {
    const res = await fetch(`${SERVER_URL}/projects`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseJson<ProjectSummary>(res)
}

export async function updateProjectName(projectId: string, update: UpdateProjectRequest): Promise<ProjectSummary> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(update),
    })
    return parseJson<ProjectSummary>(res)
}

export async function deleteProjectById(projectId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}`, {method: 'DELETE'})
    if (!res.ok) {
        const error = await res.text()
        throw new Error(error || `Failed to delete project (${res.status})`)
    }
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettings> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/settings`)
    const data = await parseJson<{ settings: ProjectSettings }>(res)
    return data.settings
}

export async function updateProjectSettings(projectId: string, updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates),
    })
    const data = await parseJson<{ settings: ProjectSettings }>(res)
    return data.settings
}

export async function listProjectBranches(projectId: string): Promise<ProjectBranchInfo[]> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/git/branches`)
    const data = await parseJson<{ branches: ProjectBranchInfo[] }>(res)
    return data.branches
}

export async function getNextTicketKey(projectId: string): Promise<TicketKeyPreview> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/tickets/next-key`)
    const data = await parseJson<{ preview: TicketKeyPreview }>(res)
    return data.preview
}

export async function getProjectGithubOrigin(projectId: string): Promise<GitOriginResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/github/origin`)
    return parseJson<GitOriginResponse>(res)
}

export async function importGithubIssues(boardId: string, payload: ImportIssuesRequest): Promise<ImportIssuesResponse> {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/import/github/issues`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseJson<ImportIssuesResponse>(res)
}
