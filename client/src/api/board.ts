import {SERVER_URL} from '@/lib/env'
import type {BoardState, Card, Column, ColumnId} from 'shared'

const jsonHeaders = {'Content-Type': 'application/json'}

async function handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text()
        const error = new Error(text || `Request failed (${res.status})`)
        ;(error as any).status = res.status
        throw error
    }
    return (await res.json()) as T
}

export type MoveCardResponse = {
    card: Card;
    columns: Record<ColumnId, Column>;
}

export async function fetchBoardState(boardId: string): Promise<BoardState> {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}`)
    const data = await handle<{ state: BoardState }>(res)
    return data.state
}

export async function createCard(
    boardId: string,
    columnId: string,
    values: { title: string; description?: string | null; dependsOn?: string[] },
) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
            columnId,
            title: values.title,
            description: values.description ?? null,
            dependsOn: values.dependsOn ?? []
        }),
    })
    return handle(res)
}

export async function updateCard(
    boardId: string,
    cardId: string,
    values: { title?: string; description?: string | null; dependsOn?: string[] },
) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards/${cardId}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({
            title: values.title,
            description: values.description ?? null,
            dependsOn: values.dependsOn,
        }),
    })
    return handle(res)
}

export async function deleteCard(boardId: string, cardId: string) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards/${cardId}`, {
        method: 'DELETE',
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed to delete card (${res.status})`)
    }
}

export async function moveCard(boardId: string, cardId: string, toColumnId: string, toIndex: number) {
    const res = await fetch(`${SERVER_URL}/boards/${boardId}/cards/${cardId}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({columnId: toColumnId, index: toIndex}),
    })
    return handle<MoveCardResponse>(res)
}
