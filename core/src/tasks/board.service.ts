import type {BoardState} from 'shared'
import {withTx, type DbExecutor} from '../db/with-tx'
import {listColumnsForBoard, insertColumn, listCardsForColumns, getBoardById} from '../projects/repo'
import {listDependenciesForCards} from '../projects/dependencies'
import {publishTaskEvent} from './events'

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

export async function ensureDefaultColumns(boardId: string, executor?: DbExecutor) {
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
        publishTaskEvent('board.columns.initialized', {boardId, columnIds: createdIds})
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
            prUrl: card.prUrl ?? undefined,
            ticketType: card.ticketType ?? null,
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

/** Broadcast the entire board state to all project subscribers. */
export async function broadcastBoard(boardId: string) {
    const board = await getBoardState(boardId)
    publishTaskEvent('board.state.changed', {boardId, state: board})
}

export async function ensureBoardExists(boardId: string) {
    const existing = await getBoardById(boardId)
    if (!existing) throw new Error('Board not found')
    await ensureDefaultColumns(boardId)
}
