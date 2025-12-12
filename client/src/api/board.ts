import {SERVER_URL} from '@/lib/env'
import type {BoardState, Card, Column, ColumnId, TicketType, GithubIssueStatsResponse} from 'shared'
import {parseApiResponse} from '@/api/http'

const jsonHeaders = {'Content-Type': 'application/json'}

export type MoveCardResponse = {
    card: Card;
    columns: Record<ColumnId, Column>;
}

export type CreateCardResponse = {
    state: BoardState;
    cardId: string;
    githubIssueError?: string | null;
}

export async function fetchBoardState(boardId: string): Promise<BoardState> {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}`)
    const data = await parseApiResponse<{ state: BoardState }>(res)
    return data.state
}

export async function fetchGithubIssueStats(boardId: string): Promise<GithubIssueStatsResponse> {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/github/issues/stats`)
    return parseApiResponse<GithubIssueStatsResponse>(res)
}

export async function createCard(
    boardId: string,
    columnId: string,
    values: { title: string; description?: string | null; dependsOn?: string[]; ticketType?: TicketType | null; createGithubIssue?: boolean },
): Promise<CreateCardResponse> {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
            columnId,
            title: values.title,
            description: values.description ?? null,
            dependsOn: values.dependsOn ?? [],
            ticketType: values.ticketType ?? null,
            createGithubIssue: values.createGithubIssue === true,
        }),
    })
    return parseApiResponse<CreateCardResponse>(res)
}

export async function updateCard(
    boardId: string,
    cardId: string,
    values: { title?: string; description?: string | null; dependsOn?: string[]; ticketType?: TicketType | null; isEnhanced?: boolean },
) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards/${cardId}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
            title: values.title,
            description: values.description ?? null,
            dependsOn: values.dependsOn,
            ticketType: values.ticketType === undefined ? undefined : values.ticketType ?? null,
            isEnhanced: values.isEnhanced,
        }),
    })
    return parseApiResponse(res)
}

export async function deleteCard(boardId: string, cardId: string) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards/${cardId}`, {
        method: 'DELETE',
    })
    await parseApiResponse(res)
}

export async function moveCard(boardId: string, cardId: string, toColumnId: string, toIndex: number) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards/${cardId}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({columnId: toColumnId, index: toIndex}),
    })
    return parseApiResponse<MoveCardResponse>(res)
}
