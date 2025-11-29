import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {SubtaskListResponse, CreateSubtaskRequest, UpdateSubtaskRequest, ReorderSubtasksRequest} from 'shared'
import {fetchSubtasks, createSubtask, updateSubtask, deleteSubtask, reorderSubtasks} from '@/api/subtasks'

export const subtaskKeys = {
    all: ['subtasks'] as const,
    ticket: (projectId: string, ticketId: string) => [...subtaskKeys.all, projectId, ticketId] as const,
}

type SubtaskListOptions = Partial<UseQueryOptions<SubtaskListResponse>>

export function useSubtasks(
    projectId: string | undefined,
    ticketId: string | undefined,
    options?: SubtaskListOptions,
) {
    const enabled = Boolean(projectId && ticketId)
    return useQuery({
        queryKey: projectId && ticketId ? subtaskKeys.ticket(projectId, ticketId) : ['subtasks', 'disabled'],
        queryFn: () => fetchSubtasks(projectId!, ticketId!),
        enabled,
        ...options,
    })
}

type CreateArgs = {projectId: string; ticketId: string; input: CreateSubtaskRequest}
type UpdateArgs = {projectId: string; subtaskId: string; input: UpdateSubtaskRequest}
type DeleteArgs = {projectId: string; subtaskId: string}
type ReorderArgs = {projectId: string; ticketId: string; input: ReorderSubtasksRequest}

type CreateOptions = UseMutationOptions<SubtaskListResponse, Error, CreateArgs>
type UpdateOptions = UseMutationOptions<SubtaskListResponse, Error, UpdateArgs>
type DeleteOptions = UseMutationOptions<SubtaskListResponse, Error, DeleteArgs>
type ReorderOptions = UseMutationOptions<SubtaskListResponse, Error, ReorderArgs>

export function useCreateSubtask(options?: CreateOptions) {
    return useMutation({
        mutationFn: ({projectId, ticketId, input}: CreateArgs) => createSubtask(projectId, ticketId, input),
        ...options,
    })
}

export function useUpdateSubtask(options?: UpdateOptions) {
    return useMutation({
        mutationFn: ({projectId, subtaskId, input}: UpdateArgs) => updateSubtask(projectId, subtaskId, input),
        ...options,
    })
}

export function useDeleteSubtask(options?: DeleteOptions) {
    return useMutation({
        mutationFn: ({projectId, subtaskId}: DeleteArgs) => deleteSubtask(projectId, subtaskId),
        ...options,
    })
}

export function useReorderSubtasks(options?: ReorderOptions) {
    return useMutation({
        mutationFn: ({projectId, ticketId, input}: ReorderArgs) => reorderSubtasks(projectId, ticketId, input),
        ...options,
    })
}

