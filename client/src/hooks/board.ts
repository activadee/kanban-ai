import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {BoardState, GithubIssueStatsResponse} from 'shared'
import {
    fetchBoardState,
    fetchGithubIssueStats,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    type MoveCardResponse,
    type CreateCardResponse,
} from '@/api/board'

export const boardKeys = {
    all: ['board'] as const,
    state: (boardId: string) => [...boardKeys.all, boardId] as const,
    githubIssueStats: (boardId: string) => [...boardKeys.all, boardId, 'github-issue-stats'] as const,
}

type BoardOptions = Partial<UseQueryOptions<BoardState>>

type CreateArgs = {
    boardId: string;
    columnId: string;
    values: { title: string; description?: string | null; dependsOn?: string[]; ticketType?: import('shared').TicketType | null; createGithubIssue?: boolean }
}

type UpdateArgs = {
    boardId: string;
    cardId: string;
    values: { title?: string; description?: string | null; dependsOn?: string[]; ticketType?: import('shared').TicketType | null }
}

type DeleteArgs = { boardId: string; cardId: string }

type MoveArgs = { boardId: string; cardId: string; toColumnId: string; toIndex: number }

export function useBoardState(boardId: string | undefined, options?: BoardOptions) {
    const enabled = Boolean(boardId)
    return useQuery({
        queryKey: boardId ? boardKeys.state(boardId) : ['board', 'disabled'],
        queryFn: () => fetchBoardState(boardId!),
        enabled,
        ...options,
    })
}

type GithubIssueStatsOptions = Partial<UseQueryOptions<GithubIssueStatsResponse>>

export function useGithubIssueStats(boardId: string | undefined, options?: GithubIssueStatsOptions) {
    const enabled = Boolean(boardId)
    return useQuery({
        queryKey: boardId ? boardKeys.githubIssueStats(boardId) : ['board', 'github-issue-stats', 'disabled'],
        queryFn: () => fetchGithubIssueStats(boardId!),
        enabled,
        ...options,
    })
}

type CreateOptions = UseMutationOptions<CreateCardResponse, Error, CreateArgs>

type UpdateOptions = UseMutationOptions<unknown, Error, UpdateArgs>

type DeleteOptions = UseMutationOptions<unknown, Error, DeleteArgs>

type MoveOptions = UseMutationOptions<MoveCardResponse, Error, MoveArgs>

export function useCreateCard(options?: CreateOptions) {
    return useMutation<CreateCardResponse, Error, CreateArgs>({
        mutationFn: ({boardId, columnId, values}: CreateArgs) => createCard(boardId, columnId, values),
        ...options,
    })
}

export function useUpdateCard(options?: UpdateOptions) {
    return useMutation({
        mutationFn: ({boardId, cardId, values}: UpdateArgs) => updateCard(boardId, cardId, values),
        ...options,
    })
}

export function useDeleteCard(options?: DeleteOptions) {
    return useMutation({
        mutationFn: ({boardId, cardId}: DeleteArgs) => deleteCard(boardId, cardId),
        ...options,
    })
}

export function useMoveCard(options?: MoveOptions) {
    return useMutation({
        mutationFn: ({
                         boardId,
                         cardId,
                         toColumnId,
                         toIndex
                     }: MoveArgs) => moveCard(boardId, cardId, toColumnId, toIndex),
        ...options,
    })
}
