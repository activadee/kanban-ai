import {asc, desc, eq, inArray, sql} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {boards, cards, columns} from '../db/schema'
import type {
    ProjectsRepo,
    BoardUpdate,
    ColumnUpdate,
    CardUpdate,
    CardWithColumnBoard,
} from 'core/repos/interfaces'
import type {
    BoardRow,
    BoardInsert,
    ColumnRow,
    ColumnInsert,
    CardRow,
    CardInsert,
} from 'core/db/types'

export function createProjectsRepo(db: BunSQLiteDatabase): ProjectsRepo {
    return {
        async listBoards(): Promise<BoardRow[]> {
            return db.select().from(boards).orderBy(desc(boards.createdAt))
        },

        async getBoardById(id: string): Promise<BoardRow | null> {
            const [row] = await db.select().from(boards).where(eq(boards.id, id)).limit(1)
            return row ?? null
        },

        async listBoardIds(): Promise<string[]> {
            const rows = await db.select({id: boards.id}).from(boards)
            return (rows as Array<{id: string}>).map((row) => row.id)
        },

        async getRepositoryPath(boardId: string): Promise<string | null> {
            const [row] = await db
                .select({path: boards.repositoryPath})
                .from(boards)
                .where(eq(boards.id, boardId))
                .limit(1)
            return row?.path ?? null
        },

        async insertBoard(values: BoardInsert): Promise<void> {
            await db.insert(boards).values(values).run()
        },

        async updateBoard(id: string, patch: BoardUpdate): Promise<void> {
            await db.update(boards).set(patch).where(eq(boards.id, id)).run()
        },

        async deleteBoard(id: string): Promise<void> {
            await db.delete(boards).where(eq(boards.id, id)).run()
        },

        async listColumnsForBoard(boardId: string): Promise<ColumnRow[]> {
            return db.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.order))
        },

        async getColumnById(columnId: string): Promise<ColumnRow | null> {
            const [row] = await db.select().from(columns).where(eq(columns.id, columnId)).limit(1)
            return row ?? null
        },

        async insertColumn(values: ColumnInsert): Promise<void> {
            await db.insert(columns).values(values).run()
        },

        async updateColumn(columnId: string, patch: ColumnUpdate): Promise<void> {
            await db.update(columns).set(patch).where(eq(columns.id, columnId)).run()
        },

        async listCardsForColumns(columnIds: string[]): Promise<CardRow[]> {
            if (columnIds.length === 0) return []
            return db.select().from(cards).where(inArray(cards.columnId, columnIds)).orderBy(asc(cards.order))
        },

        async listCardsForBoard(boardId: string): Promise<CardRow[]> {
            return db.select().from(cards).where(eq(cards.boardId, boardId)).orderBy(asc(cards.createdAt))
        },

        async getCardById(cardId: string): Promise<CardRow | null> {
            const [row] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1)
            return row ?? null
        },

        async insertCard(values: CardInsert): Promise<void> {
            await db.insert(cards).values(values).run()
        },

        async updateCard(cardId: string, patch: CardUpdate): Promise<void> {
            await db.update(cards).set(patch).where(eq(cards.id, cardId)).run()
        },

        async deleteCard(cardId: string): Promise<void> {
            await db.delete(cards).where(eq(cards.id, cardId)).run()
        },

        async getMaxCardOrder(columnId: string): Promise<number> {
            const [row] = await db
                .select({max: sql<number>`coalesce(max(${cards.order}), -1)`})
                .from(cards)
                .where(eq(cards.columnId, columnId))
            return row?.max ?? -1
        },

        async listCardsWithColumn(boardId: string): Promise<CardWithColumnBoard[]> {
            return db
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
        },
    }
}
