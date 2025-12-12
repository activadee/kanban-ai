import {and, asc, desc, eq, inArray, sql} from 'drizzle-orm'
import {boards, cards, columns, type Board, type Card, type Column} from '../db/schema'
import type {TicketType} from 'shared'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

export type BoardInsert = typeof boards.$inferInsert
export type BoardUpdate = Partial<typeof boards.$inferInsert>
export type ColumnInsert = typeof columns.$inferInsert
export type CardInsert = typeof cards.$inferInsert
export type CardUpdate = Partial<typeof cards.$inferInsert> & { ticketType?: TicketType | null }

export async function listBoards(executor?: DbExecutor): Promise<Board[]> {
    const database = resolveDb(executor)
    return database.select().from(boards).orderBy(desc(boards.createdAt))
}

export async function getBoardById(id: string, executor?: DbExecutor): Promise<Board | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(boards).where(eq(boards.id, id)).limit(1)
    return row ?? null
}

export async function listBoardIds(executor?: DbExecutor): Promise<string[]> {
    const database = resolveDb(executor)
    const rows = await database.select({id: boards.id}).from(boards)
    return (rows as Array<{ id: string }>).map((row) => row.id)
}

export async function getRepositoryPath(boardId: string, executor?: DbExecutor): Promise<string | null> {
    const database = resolveDb(executor)
    const [row] = await database.select({path: boards.repositoryPath}).from(boards).where(eq(boards.id, boardId)).limit(1)
    return row?.path ?? null
}

export async function insertBoard(values: BoardInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.insert(boards).values(values).run()
}

export async function updateBoard(id: string, patch: BoardUpdate, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.update(boards).set(patch).where(eq(boards.id, id)).run()
}

export async function deleteBoard(id: string, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.delete(boards).where(eq(boards.id, id)).run()
}

export async function listColumnsForBoard(boardId: string, executor?: DbExecutor): Promise<Column[]> {
    const database = resolveDb(executor)
    return database.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.order))
}

export async function getColumnById(columnId: string, executor?: DbExecutor): Promise<Column | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(columns).where(eq(columns.id, columnId)).limit(1)
    return row ?? null
}

export async function insertColumn(values: ColumnInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.insert(columns).values(values).run()
}

export async function updateColumn(columnId: string, patch: Partial<typeof columns.$inferInsert>, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.update(columns).set(patch).where(eq(columns.id, columnId)).run()
}

export async function listCardsForColumns(columnIds: string[], executor?: DbExecutor): Promise<Card[]> {
    if (columnIds.length === 0) return []
    const database = resolveDb(executor)
    return database.select().from(cards).where(inArray(cards.columnId, columnIds)).orderBy(asc(cards.order))
}

export async function listCardsForBoard(boardId: string, executor?: DbExecutor): Promise<Card[]> {
    const database = resolveDb(executor)
    return database.select().from(cards).where(eq(cards.boardId, boardId)).orderBy(asc(cards.createdAt))
}

export async function getCardById(cardId: string, executor?: DbExecutor): Promise<Card | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(cards).where(eq(cards.id, cardId)).limit(1)
    return row ?? null
}

export async function insertCard(values: CardInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.insert(cards).values(values).run()
}

export async function updateCard(cardId: string, patch: CardUpdate, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.update(cards).set(patch).where(eq(cards.id, cardId)).run()
}

export async function deleteCard(cardId: string, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.delete(cards).where(eq(cards.id, cardId)).run()
}

export async function getMaxCardOrder(columnId: string, executor?: DbExecutor): Promise<number> {
    const database = resolveDb(executor)
    const [row] = await database
        .select({max: sql<number>`coalesce(max(${cards.order}), -1)`})
        .from(cards)
        .where(eq(cards.columnId, columnId))
    return row?.max ?? -1
}

export type CardWithColumnBoard = {
    id: string
    ticketKey: string | null
    boardId: string | null
    columnId: string
    columnBoardId: string | null
    createdAt: Date | number | string
}

export async function listCardsWithColumn(boardId: string, executor?: DbExecutor): Promise<CardWithColumnBoard[]> {
    const database = resolveDb(executor)
    return database
        .select({
            id: cards.id,
            ticketKey: cards.ticketKey,
            boardId: cards.boardId,
            columnId: cards.columnId,
            columnBoardId: columns.boardId,
            createdAt: cards.createdAt,
        })
        .from(cards)
        .innerJoin(columns, eq(cards.columnId, columns.id))
        .where(eq(columns.boardId, boardId))
        .orderBy(asc(cards.createdAt))
}

export async function findCardsByPrUrls(
    boardId: string,
    prUrls: string[],
    executor?: DbExecutor,
): Promise<Card[]> {
    const urls = prUrls.map((u) => u.trim()).filter((u) => u.length > 0)
    if (urls.length === 0) return []
    const database = resolveDb(executor)
    return database
        .select()
        .from(cards)
        .where(
            and(
                eq(cards.boardId, boardId),
                inArray(cards.prUrl, urls),
                eq((cards as any).disableAutoCloseOnPRMerge, false),
            ),
        )
        .orderBy(asc(cards.createdAt))
}
