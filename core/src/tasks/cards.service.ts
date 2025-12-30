import type {TicketType} from 'shared'
import {withRepoTx} from '../repos/provider'
import {
    listColumnsForBoard,
    getColumnById,
    listCardsForColumns,
    getCardById,
    updateCard,
    getMaxCardOrder,
    type CardUpdate,
} from '../projects/repo'
import {isUniqueTicketKeyError, reserveNextTicketKey} from '../projects/tickets/service'
import {publishTaskEvent} from './events'
import {broadcastBoard, ensureDefaultColumns} from './board.service'

async function reorderColumn(columnId: string) {
    const cards = await listCardsForColumns([columnId])
    for (const [index, card] of cards.entries()) {
        if (card.order === index) continue
        await updateCard(card.id, {order: index, updatedAt: new Date()})
    }
}

export async function createBoardCard(
    columnId: string,
    title: string,
    description?: string,
    ticketType?: TicketType | null,
    opts?: {
        suppressBroadcast?: boolean
    },
): Promise<string> {
    const maxAttempts = 3
    let createdCardId: string | null = null
    let createdBoardId: string | null = null
    let createdColumnId: string | null = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            await withRepoTx(async (provider) => {
                const columnRow = await provider.projects.getColumnById(columnId)
                if (!columnRow) throw new Error('Column not found')

                const nextOrder = (await provider.projects.getMaxCardOrder(columnId)) + 1
                const now = new Date()
                const {key} = await reserveNextTicketKey(columnRow.boardId, now)
                const cardId = `card-${crypto.randomUUID()}`
                await provider.projects.insertCard({
                    id: cardId,
                    title,
                    description: description ?? null,
                    ticketType: ticketType ?? null,
                    order: nextOrder,
                    columnId,
                    boardId: columnRow.boardId,
                    ticketKey: key,
                    createdAt: now,
                    updatedAt: now,
                })
                createdCardId = cardId
                createdBoardId = columnRow.boardId
                createdColumnId = columnId
            })
            break
        } catch (error) {
            if (isUniqueTicketKeyError(error) && attempt < maxAttempts - 1) {
                continue
            }
            throw error
        }
    }

    if (!createdCardId || !createdBoardId || !createdColumnId) {
        throw new Error('Failed to create card')
    }

    if (createdCardId && createdBoardId && createdColumnId) {
        publishTaskEvent('card.created', {
            boardId: createdBoardId,
            columnId: createdColumnId,
            cardId: createdCardId,
        })
        if (!opts?.suppressBroadcast) {
            await broadcastBoard(createdBoardId)
        }
    }
    return createdCardId
}

export async function moveBoardCard(
    cardId: string,
    toColumnId: string,
    toIndex: number,
    opts?: {suppressBroadcast?: boolean},
) {
    let boardId: string | null = null
    let fromColumnId: string | null = null
    await withRepoTx(async (provider) => {
        const cardRow = await provider.projects.getCardById(cardId)
        if (!cardRow) throw new Error('Card not found')

        const currentColumn = cardRow.columnId
        const currentColumnRow = await provider.projects.getColumnById(currentColumn)
        const targetColumn = await provider.projects.getColumnById(toColumnId)
        if (!targetColumn) throw new Error('Target column not found')

        const cardBoardId = cardRow.boardId ?? currentColumnRow?.boardId
        if (!cardBoardId || targetColumn.boardId !== cardBoardId) throw new Error('Cannot move card across boards')

        const now = new Date()
        const effectiveIndex = Math.max(0, toIndex)

        await provider.projects.updateCard(cardId, {columnId: toColumnId, order: effectiveIndex, updatedAt: now})
        boardId = cardBoardId
        fromColumnId = currentColumn
    })

    await reorderColumn(toColumnId)
    if (fromColumnId && fromColumnId !== toColumnId) {
        await reorderColumn(fromColumnId)
    }

    if (boardId) {
        publishTaskEvent('card.moved', {
            boardId,
            cardId,
            fromColumnId: fromColumnId ?? toColumnId,
            toColumnId,
            toIndex,
        })
        if (!opts?.suppressBroadcast) {
            await broadcastBoard(boardId)
        }
    }
}

export async function moveCardToColumnByTitle(
    boardId: string,
    cardId: string,
    columnTitle: string,
    opts?: {fallbackToFirst?: boolean},
) {
    await ensureDefaultColumns(boardId)
    const columns = await listColumnsForBoard(boardId)
    if (columns.length === 0) return
    const desired = columnTitle.trim().toLowerCase()
    const target =
        columns.find(
            (c) => (c.title || '').trim().toLowerCase() === desired,
        ) ?? null

    if (!target) {
        if (opts?.fallbackToFirst === false) return
        const fallback = columns[0]!
        const fallbackOrder = (await getMaxCardOrder(fallback.id)) + 1
        await moveBoardCard(cardId, fallback.id, fallbackOrder)
        return
    }

    const nextOrder = (await getMaxCardOrder(target.id)) + 1
    await moveBoardCard(cardId, target.id, nextOrder)
}

export async function updateBoardCard(
    cardId: string,
    updates: {
        title?: string;
        description?: string;
        ticketType?: TicketType | null;
        disableAutoCloseOnPRMerge?: boolean;
        isEnhanced?: boolean;
    },
    opts?: {
    suppressBroadcast?: boolean
}) {
    const existing = await getCardById(cardId)
    if (!existing) return

    let boardId = existing.boardId ?? null
    if (!boardId) {
        const column = await getColumnById(existing.columnId)
        boardId = column?.boardId ?? null
    }

    const payload: CardUpdate & { ticketType?: TicketType | null } = {
        updatedAt: new Date(),
    }
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.description !== undefined) payload.description = updates.description ?? null
    if (updates.ticketType !== undefined) payload.ticketType = updates.ticketType ?? null
    const disableAutoCloseOnPRMerge =
        typeof updates.disableAutoCloseOnPRMerge === 'boolean'
            ? updates.disableAutoCloseOnPRMerge
            : undefined
    const isEnhanced =
        typeof updates.isEnhanced === 'boolean' ? updates.isEnhanced : undefined

    if (disableAutoCloseOnPRMerge !== undefined) {
        payload.disableAutoCloseOnPRMerge = disableAutoCloseOnPRMerge
    }
    if (isEnhanced !== undefined) {
        payload.isEnhanced = isEnhanced
    }

    await updateCard(cardId, payload)

    if (boardId) {
        publishTaskEvent('card.updated', {
            boardId,
            cardId,
            changes: {
                title: updates.title,
                description: updates.description ?? null,
                ticketType: updates.ticketType ?? null,
                disableAutoCloseOnPRMerge,
                isEnhanced,
            },
        })
        if (!opts?.suppressBroadcast) {
            await broadcastBoard(boardId)
        }
    }
}

export async function deleteBoardCard(cardId: string) {
    let boardId: string | null = null
    let columnId: string | null = null
    await withRepoTx(async (provider) => {
        const cardRow = await provider.projects.getCardById(cardId)
        if (!cardRow) return
        boardId = cardRow.boardId ?? null
        columnId = cardRow.columnId
        await provider.projects.deleteCard(cardId)
    })

    if (columnId) {
        await reorderColumn(columnId)
    }

    if (!boardId && columnId) {
        const column = await getColumnById(columnId)
        boardId = column?.boardId ?? null
    }

    if (columnId) {
        publishTaskEvent('card.deleted', {
            boardId: boardId ?? columnId,
            cardId,
            columnId,
        })
    }

    if (boardId) {
        await broadcastBoard(boardId)
    }
}
