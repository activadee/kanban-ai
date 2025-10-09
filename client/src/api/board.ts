import {SERVER_URL} from '@/lib/env'
import type {BoardState} from 'shared'

const jsonHeaders = {'Content-Type': 'application/json'}

async function handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
    }
    return (await res.json()) as T
}

export async function fetchBoardState(projectId: string): Promise<BoardState> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/board-state`)
    const data = await handle<{ state: BoardState }>(res)
    return data.state
}

export async function createCard(
    projectId: string,
    columnId: string,
    values: { title: string; description?: string | null; dependsOn?: string[] },
) {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards`, {
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
    projectId: string,
    cardId: string,
    values: { title?: string; description?: string | null; dependsOn?: string[] },
) {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}`, {
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

export async function deleteCard(projectId: string, cardId: string) {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}`, {
        method: 'DELETE',
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed to delete card (${res.status})`)
    }
}

export async function moveCard(projectId: string, cardId: string, toColumnId: string, toIndex: number) {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}/move`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({toColumnId, toIndex}),
    })
    return handle(res)
}
