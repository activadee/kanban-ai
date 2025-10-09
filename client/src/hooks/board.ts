import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {BoardState} from 'shared'
import {fetchBoardState, createCard, updateCard, deleteCard, moveCard} from '@/api/board'

export const boardKeys = {
    all: ['board'] as const,
    state: (projectId: string) => [...boardKeys.all, projectId] as const,
}

type BoardOptions = Partial<UseQueryOptions<BoardState>>

type CreateArgs = {
    projectId: string;
    columnId: string;
    values: { title: string; description?: string | null; dependsOn?: string[] }
}

type UpdateArgs = {
    projectId: string;
    cardId: string;
    values: { title?: string; description?: string | null; dependsOn?: string[] }
}

type DeleteArgs = { projectId: string; cardId: string }

type MoveArgs = { projectId: string; cardId: string; toColumnId: string; toIndex: number }

export function useBoardState(projectId: string | undefined, options?: BoardOptions) {
    const enabled = Boolean(projectId)
    return useQuery({
        queryKey: projectId ? boardKeys.state(projectId) : ['board', 'disabled'],
        queryFn: () => fetchBoardState(projectId!),
        enabled,
        ...options,
    })
}

type CreateOptions = UseMutationOptions<unknown, Error, CreateArgs>

type UpdateOptions = UseMutationOptions<unknown, Error, UpdateArgs>

type DeleteOptions = UseMutationOptions<unknown, Error, DeleteArgs>

type MoveOptions = UseMutationOptions<unknown, Error, MoveArgs>

export function useCreateCard(options?: CreateOptions) {
    return useMutation({
        mutationFn: ({projectId, columnId, values}: CreateArgs) => createCard(projectId, columnId, values),
        ...options,
    })
}

export function useUpdateCard(options?: UpdateOptions) {
    return useMutation({
        mutationFn: ({projectId, cardId, values}: UpdateArgs) => updateCard(projectId, cardId, values),
        ...options,
    })
}

export function useDeleteCard(options?: DeleteOptions) {
    return useMutation({
        mutationFn: ({projectId, cardId}: DeleteArgs) => deleteCard(projectId, cardId),
        ...options,
    })
}

export function useMoveCard(options?: MoveOptions) {
    return useMutation({
        mutationFn: ({
                         projectId,
                         cardId,
                         toColumnId,
                         toIndex
                     }: MoveArgs) => moveCard(projectId, cardId, toColumnId, toIndex),
        ...options,
    })
}
