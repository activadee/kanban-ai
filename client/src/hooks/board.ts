import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {BoardState, GithubIssueStatsResponse, MessageImage} from 'shared'
import {
    fetchBoardState,
    fetchGithubIssueStats,
    fetchCardImages,
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
    cardImages: (boardId: string, cardId: string) => [...boardKeys.all, boardId, 'cards', cardId, 'images'] as const,
}

type BoardOptions = Partial<UseQueryOptions<BoardState>>

type CreateArgs = {
    boardId: string;
    columnId: string;
    values: { title: string; description?: string | null; dependsOn?: string[]; ticketType?: import('shared').TicketType | null; createGithubIssue?: boolean; images?: import('shared').MessageImage[] }
}

type UpdateArgs = {
    boardId: string;
    cardId: string;
    values: { title?: string; description?: string | null; dependsOn?: string[]; ticketType?: import('shared').TicketType | null; isEnhanced?: boolean; images?: import('shared').MessageImage[] }
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

type CardImagesOptions = Partial<UseQueryOptions<MessageImage[]>>

export function useCardImages(boardId: string | undefined, cardId: string | undefined, options?: CardImagesOptions) {
    const enabled = Boolean(boardId && cardId)
    return useQuery({
        queryKey: boardId && cardId ? boardKeys.cardImages(boardId, cardId) : ['board', 'cards', 'images', 'disabled'],
        queryFn: () => fetchCardImages(boardId!, cardId!),
        enabled,
        ...options,
    })
}
