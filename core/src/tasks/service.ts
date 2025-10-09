import type {BoardState} from 'shared'
import {withTx, type DbExecutor} from '../db/with-tx'
import {
    listColumnsForBoard,
    getColumnById,
    insertColumn,
    listCardsForColumns,
    getCardById,
    insertCard,
    updateCard,
    deleteCard,
    getMaxCardOrder,
    getBoardById,
} from '../projects/repo'
import {listDependenciesForCards} from '../projects/dependencies'
import {isUniqueTicketKeyError, reserveNextTicketKey} from '../projects/tickets/service'
import type {AppEventBus} from '../events/bus'
import type {AppEventName, AppEventPayload} from '../events/types'

let taskEvents: AppEventBus | null = null

export function bindTaskEventBus(bus: AppEventBus) {
    taskEvents = bus
}

function publishEvent<Name extends AppEventName>(name: Name, payload: AppEventPayload<Name>) {
    taskEvents?.publish(name, payload)
}

const DEFAULT_COLUMNS = [
    {title: 'Backlog'},
    {title: 'In Progress'},
    {title: 'Review'},
    {title: 'Done'},
]

function toIso(value: Date | string | number | null | undefined) {
    if (!value) return new Date().toISOString()
    if (value instanceof Date) return value.toISOString()
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

async function ensureDefaultColumns(boardId: string, executor?: DbExecutor) {
    const existing = await listColumnsForBoard(boardId, executor)
    if (existing.length > 0) return

    const createdIds: string[] = []
    const run = async (tx: DbExecutor) => {
        const now = new Date()
        for (const [index, item] of DEFAULT_COLUMNS.entries()) {
            const columnId = `col-${crypto.randomUUID()}`
            await insertColumn(
                {
                    id: columnId,
                    title: item.title,
                    order: index,
                    boardId,
                    createdAt: now,
                    updatedAt: now,
                },
                tx,
            )
            createdIds.push(columnId)
        }
    }

    if (executor) {
        await run(executor)
    } else {
        await withTx(async (tx) => run(tx))
    }

    if (createdIds.length > 0) {
        publishEvent('board.columns.initialized', {boardId, columnIds: createdIds})
    }
}

async function reorderColumn(columnId: string, executor: DbExecutor) {
    const cards = await listCardsForColumns([columnId], executor)
    for (const [index, card] of cards.entries()) {
        if (card.order === index) continue
        await updateCard(card.id, {order: index, updatedAt: new Date()}, executor)
    }
}

export async function getBoardState(boardId: string): Promise<BoardState> {
    await ensureDefaultColumns(boardId)

    const columnRows = await listColumnsForBoard(boardId)
    const columnIds = columnRows.map((col) => col.id)
    const cardRows = await listCardsForColumns(columnIds)
    const depMap = await listDependenciesForCards(cardRows.map((c) => c.id))

    const boardState: BoardState = {
        columns: {},
        columnOrder: [],
        cards: {},
    }

    for (const column of columnRows) {
        boardState.columns[column.id] = {
            id: column.id,
            title: column.title,
            cardIds: [],
        }
        boardState.columnOrder.push(column.id)
    }

    for (const card of cardRows) {
        const column = boardState.columns[card.columnId]
        if (!column) continue
        column.cardIds.push(card.id)
        boardState.cards[card.id] = {
            id: card.id,
            ticketKey: card.ticketKey ?? undefined,
            title: card.title,
            description: card.description ?? undefined,
            dependsOn: depMap.get(card.id) ?? undefined,
            createdAt: toIso(card.createdAt),
            updatedAt: toIso(card.updatedAt),
        }
    }

    return boardState
}

export async function createDefaultBoardStructure(boardId: string) {
    await ensureDefaultColumns(boardId)
}

export async function createBoardCard(columnId: string, title: string, description?: string, opts?: {
    suppressBroadcast?: boolean
}): Promise<string> {
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
        publishEvent('card.created', {
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

export async function moveBoardCard(cardId: string, toColumnId: string, toIndex: number) {
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
        publishEvent('card.moved', {
            boardId,
            cardId,
            fromColumnId: fromColumnId ?? toColumnId,
            toColumnId,
            toIndex,
        })
        await broadcastBoard(boardId)
    }
}

/** Move card to the last position of the column with the given title on this board. */
export async function moveCardToColumnByTitle(boardId: string, cardId: string, columnTitle: string) {
    await ensureDefaultColumns(boardId)
    const columns = await listColumnsForBoard(boardId)
    if (columns.length === 0) return
    const target = columns.find((c) => c.title === columnTitle) ?? columns[0]!
    const nextOrder = (await getMaxCardOrder(target.id)) + 1
    await moveBoardCard(cardId, target.id, nextOrder)
}

/** Broadcast the entire board state to all project subscribers. */
export async function broadcastBoard(boardId: string) {
    const board = await getBoardState(boardId)
    publishEvent('board.state.changed', {boardId, state: board})
}

export async function updateBoardCard(cardId: string, updates: { title?: string; description?: string }, opts?: {
    suppressBroadcast?: boolean
}) {
    const existing = await getCardById(cardId)
    if (!existing) return

    let boardId = existing.boardId ?? null
    if (!boardId) {
        const column = await getColumnById(existing.columnId)
        boardId = column?.boardId ?? null
    }

    const payload: Partial<Parameters<typeof updateCard>[1]> = {
        updatedAt: new Date(),
    }
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.description !== undefined) payload.description = updates.description ?? null

    await updateCard(cardId, payload)

    if (boardId) {
        publishEvent('card.updated', {
            boardId,
            cardId,
            changes: {
                title: updates.title,
                description: updates.description ?? null,
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
        publishEvent('card.deleted', {
            boardId: boardId ?? columnId,
            cardId,
            columnId,
        })
    }

    if (boardId) {
        await broadcastBoard(boardId)
    }
}

export async function ensureBoardExists(boardId: string) {
    const existing = await getBoardById(boardId)
    if (!existing) throw new Error('Board not found')
    await ensureDefaultColumns(boardId)
}

