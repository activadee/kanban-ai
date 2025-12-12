import type {TicketType} from 'shared'
import {withTx, type DbExecutor} from '../db/with-tx'
import {
    listColumnsForBoard,
    getColumnById,
    listCardsForColumns,
    getCardById,
    insertCard,
    updateCard,
    deleteCard,
    getMaxCardOrder,
    type CardUpdate,
} from '../projects/repo'
import {isUniqueTicketKeyError, reserveNextTicketKey} from '../projects/tickets/service'
import {publishTaskEvent} from './events'
import {broadcastBoard, ensureDefaultColumns} from './board.service'

async function reorderColumn(columnId: string, executor: DbExecutor) {
    const cards = await listCardsForColumns([columnId], executor)
    for (const [index, card] of cards.entries()) {
        if (card.order === index) continue
        await updateCard(card.id, {order: index, updatedAt: new Date()}, executor)
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
            await withTx(async (tx) => {
                const columnRow = await getColumnById(columnId, tx)
                if (!columnRow) throw new Error('Column not found')

                const nextOrder = (await getMaxCardOrder(columnId, tx)) + 1
                const now = new Date()
                const {key} = await reserveNextTicketKey(tx, columnRow.boardId, now)
                const cardId = `card-${crypto.randomUUID()}`
                await insertCard(
                    {
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
                    },
                    tx,
                )
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
    await withTx(async (tx) => {
        const cardRow = await getCardById(cardId, tx)
        if (!cardRow) throw new Error('Card not found')

        const currentColumn = cardRow.columnId
        const currentColumnRow = await getColumnById(currentColumn, tx)
        const targetColumn = await getColumnById(toColumnId, tx)
        if (!targetColumn) throw new Error('Target column not found')

        const cardBoardId = cardRow.boardId ?? currentColumnRow?.boardId
        if (!cardBoardId || targetColumn.boardId !== cardBoardId) throw new Error('Cannot move card across boards')

        const now = new Date()
        const effectiveIndex = Math.max(0, toIndex)

        await updateCard(cardId, {columnId: toColumnId, order: effectiveIndex, updatedAt: now}, tx)
        await reorderColumn(toColumnId, tx)
        if (currentColumn !== toColumnId) {
            await reorderColumn(currentColumn, tx)
        }
        boardId = cardBoardId
        fromColumnId = currentColumn
    })

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

/** Move card to the last position of the column with the given title on this board. */
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
    if (updates.disableAutoCloseOnPRMerge !== undefined) {
        payload.disableAutoCloseOnPRMerge = Boolean(
            updates.disableAutoCloseOnPRMerge,
        )
    }
    if (updates.isEnhanced !== undefined) {
        payload.isEnhanced = Boolean(updates.isEnhanced)
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
                disableAutoCloseOnPRMerge: updates.disableAutoCloseOnPRMerge,
                isEnhanced: updates.isEnhanced,
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
    await withTx(async (tx) => {
        const cardRow = await getCardById(cardId, tx)
        if (!cardRow) return
        boardId = cardRow.boardId ?? null
        columnId = cardRow.columnId
        await deleteCard(cardId, tx)
        await reorderColumn(cardRow.columnId, tx)
    })

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
