import {useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions} from '@tanstack/react-query'
import type {
    WorktreesListResponse,
    WorktreesSyncResponse,
    WorktreeDeleteResponse,
    WorktreeDeleteRequest,
    OrphanedWorktreeDeleteRequest,
    StaleWorktreeDeleteRequest,
} from 'shared'
import {
    getWorktrees,
    syncWorktrees,
    deleteWorktree,
    deleteOrphanedWorktree,
    deleteStaleWorktree,
} from '@/api/worktrees'

export const worktreesKeys = {
    all: ['worktrees'] as const,
    list: (projectId: string) => [...worktreesKeys.all, 'list', projectId] as const,
    disabled: ['worktrees', 'disabled'] as const,
}

export function useWorktrees(
    projectId: string | undefined,
    options?: Partial<UseQueryOptions<WorktreesListResponse>>,
) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectId ? worktreesKeys.list(projectId) : worktreesKeys.disabled,
        queryFn: () => getWorktrees(projectId!),
        enabled,
        ...options,
    })
}

type SyncArgs = {projectId: string}

export function useSyncWorktrees(
    options?: UseMutationOptions<WorktreesSyncResponse, Error, SyncArgs>,
) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({projectId}: SyncArgs) => syncWorktrees(projectId),
        onSuccess: (_data, {projectId}) => {
            queryClient.invalidateQueries({queryKey: worktreesKeys.list(projectId)})
        },
        ...options,
    })
}

type DeleteTrackedArgs = {
    projectId: string
    worktreeId: string
    options?: WorktreeDeleteRequest
}

export function useDeleteWorktree(
    mutationOptions?: UseMutationOptions<WorktreeDeleteResponse, Error, DeleteTrackedArgs>,
) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({projectId, worktreeId, options}: DeleteTrackedArgs) =>
            deleteWorktree(projectId, worktreeId, options),
        onSuccess: (_data, {projectId}) => {
            queryClient.invalidateQueries({queryKey: worktreesKeys.list(projectId)})
        },
        ...mutationOptions,
    })
}

type DeleteOrphanedArgs = {
    projectId: string
    encodedPath: string
    options: OrphanedWorktreeDeleteRequest
}

export function useDeleteOrphanedWorktree(
    mutationOptions?: UseMutationOptions<WorktreeDeleteResponse, Error, DeleteOrphanedArgs>,
) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({projectId, encodedPath, options}: DeleteOrphanedArgs) =>
            deleteOrphanedWorktree(projectId, encodedPath, options),
        onSuccess: (_data, {projectId}) => {
            queryClient.invalidateQueries({queryKey: worktreesKeys.list(projectId)})
        },
        ...mutationOptions,
    })
}

type DeleteStaleArgs = {
    projectId: string
    worktreeId: string
    options: StaleWorktreeDeleteRequest
}

export function useDeleteStaleWorktree(
    mutationOptions?: UseMutationOptions<WorktreeDeleteResponse, Error, DeleteStaleArgs>,
) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({projectId, worktreeId, options}: DeleteStaleArgs) =>
            deleteStaleWorktree(projectId, worktreeId, options),
        onSuccess: (_data, {projectId}) => {
            queryClient.invalidateQueries({queryKey: worktreesKeys.list(projectId)})
        },
        ...mutationOptions,
    })
}
