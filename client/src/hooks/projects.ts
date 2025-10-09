import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {
    CreateProjectRequest,
    ProjectBranchInfo,
    ProjectSettings,
    ProjectSummary,
    TicketKeyPreview,
    ImportIssuesResponse,
    ImportIssuesRequest,
    GitOriginResponse,
    UpdateProjectRequest,
} from 'shared'
import {
    createProject,
    deleteProjectById,
    getNextTicketKey,
    getProject,
    getProjectGithubOrigin,
    getProjectSettings,
    importGithubIssues,
    listProjectBranches,
    listProjects,
    updateProjectName,
    updateProjectSettings,
} from '@/api/projects'
import {projectsKeys, projectSettingsKeys} from '@/lib/queryClient'

export function useProjectsList(options?: Partial<UseQueryOptions<ProjectSummary[]>>) {
    return useQuery({
        queryKey: projectsKeys.list(),
        queryFn: listProjects,
        ...options,
    })
}

export function useProject(projectId: string | undefined, options?: Partial<UseQueryOptions<ProjectSummary>>) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectsKeys.detail(projectId ?? ''),
        queryFn: () => getProject(projectId ?? ''),
        enabled,
        ...options,
    })
}

export function useCreateProject(options?: UseMutationOptions<ProjectSummary, Error, CreateProjectRequest>) {
    return useMutation({
        mutationFn: (payload: CreateProjectRequest) => createProject(payload),
        ...options,
    })
}

export function useUpdateProjectName(options?: UseMutationOptions<ProjectSummary, Error, {
    projectId: string;
    update: UpdateProjectRequest
}>) {
    return useMutation({
        mutationFn: ({projectId, update}) => updateProjectName(projectId, update),
        ...options,
    })
}

export function useDeleteProject(options?: UseMutationOptions<void, Error, string>) {
    return useMutation({
        mutationFn: (projectId: string) => deleteProjectById(projectId),
        ...options,
    })
}

export function useProjectSettings(projectId: string | undefined, options?: Partial<UseQueryOptions<ProjectSettings>>) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectSettingsKeys.detail(projectId ?? ''),
        queryFn: () => getProjectSettings(projectId ?? ''),
        enabled,
        ...options,
    })
}

export function useUpdateProjectSettings(options?: UseMutationOptions<ProjectSettings, Error, {
    projectId: string;
    updates: Partial<ProjectSettings>
}>) {
    return useMutation({
        mutationFn: ({projectId, updates}) => updateProjectSettings(projectId, updates),
        ...options,
    })
}

export function useProjectBranches(projectId: string | undefined, options?: Partial<UseQueryOptions<ProjectBranchInfo[]>>) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectsKeys.branches(projectId ?? ''),
        queryFn: () => listProjectBranches(projectId ?? ''),
        enabled,
        ...options,
    })
}

export function useNextTicketKey(projectId: string | undefined, options?: Partial<UseQueryOptions<TicketKeyPreview>>) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectsKeys.nextTicketKey(projectId ?? ''),
        queryFn: () => getNextTicketKey(projectId ?? ''),
        enabled,
        ...options,
    })
}

export function useProjectGithubOrigin(projectId: string | undefined, options?: Partial<UseQueryOptions<GitOriginResponse>>) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectsKeys.githubOrigin(projectId ?? ''),
        queryFn: () => getProjectGithubOrigin(projectId ?? ''),
        enabled,
        ...options,
    })
}

export function useImportGithubIssues(options?: UseMutationOptions<ImportIssuesResponse, Error, {
    projectId: string;
    payload: ImportIssuesRequest
}>) {
    return useMutation({
        mutationFn: ({projectId, payload}) => importGithubIssues(projectId, payload),
        ...options,
    })
}
