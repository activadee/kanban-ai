import {and, asc, desc, eq, sql} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {attempts, attemptLogs, conversationItems, attemptTodos} from '../db/schema'
import type {AttemptsRepo, AttemptUpdate} from 'core/repos/interfaces'
import type {
    AttemptRow,
    AttemptInsert,
    AttemptLogRow,
    AttemptLogInsert,
    ConversationItemRow,
    ConversationItemInsert,
    AttemptTodoRow,
} from 'core/db/types'

export function createAttemptsRepo(db: BunSQLiteDatabase): AttemptsRepo {
    return {
        async getAttemptById(id: string): Promise<AttemptRow | null> {
            const [row] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
            return row ?? null
        },

        async getAttemptForCard(boardId: string, cardId: string): Promise<AttemptRow | null> {
            const [row] = await db
                .select()
                .from(attempts)
                .where(and(eq(attempts.boardId, boardId), eq(attempts.cardId, cardId)))
                .orderBy(desc(attempts.createdAt))
                .limit(1)
            return row ?? null
        },

        async insertAttempt(values: AttemptInsert): Promise<void> {
            await db.insert(attempts).values(values).run()
        },

        async updateAttempt(id: string, patch: AttemptUpdate): Promise<void> {
            await db.update(attempts).set(patch).where(eq(attempts.id, id)).run()
        },

        async listAttemptsForBoard(boardId: string): Promise<AttemptRow[]> {
            return db.select().from(attempts).where(eq(attempts.boardId, boardId)).orderBy(desc(attempts.createdAt))
        },

        async getAttemptBoardId(attemptId: string): Promise<string | null> {
            const [row] = await db
                .select({boardId: attempts.boardId})
                .from(attempts)
                .where(eq(attempts.id, attemptId))
                .limit(1)
            return row?.boardId ?? null
        },

        async listAttemptLogs(attemptId: string): Promise<AttemptLogRow[]> {
            return db.select().from(attemptLogs).where(eq(attemptLogs.attemptId, attemptId)).orderBy(asc(attemptLogs.ts))
        },

        async insertAttemptLog(values: AttemptLogInsert): Promise<void> {
            await db.insert(attemptLogs).values(values).run()
        },

        async listConversationItems(attemptId: string): Promise<ConversationItemRow[]> {
            return db
                .select()
                .from(conversationItems)
                .where(eq(conversationItems.attemptId, attemptId))
                .orderBy(asc(conversationItems.seq))
        },

        async listConversationItemsDescending(attemptId: string, limit: number): Promise<Array<{itemJson: string}>> {
            return db
                .select({itemJson: conversationItems.itemJson})
                .from(conversationItems)
                .where(eq(conversationItems.attemptId, attemptId))
                .orderBy(desc(conversationItems.seq))
                .limit(limit)
        },

        async insertConversationItem(values: ConversationItemInsert): Promise<void> {
            await db.insert(conversationItems).values(values).run()
        },

        async getNextConversationSeq(attemptId: string): Promise<number> {
            const [row] = await db
                .select({maxSeq: sql<number>`coalesce(max(${conversationItems.seq}), -1)`})
                .from(conversationItems)
                .where(eq(conversationItems.attemptId, attemptId))
            return (row?.maxSeq ?? -1) + 1
        },

        async upsertAttemptTodos(attemptId: string, todosJson: string): Promise<void> {
            await db
                .insert(attemptTodos)
                .values({attemptId, todosJson})
                .onConflictDoUpdate({
                    target: attemptTodos.attemptId,
                    set: {todosJson, updatedAt: new Date()},
                })
                .run()
        },

        async getAttemptTodos(attemptId: string): Promise<AttemptTodoRow | null> {
            const [row] = await db.select().from(attemptTodos).where(eq(attemptTodos.attemptId, attemptId)).limit(1)
            return row ?? null
        },
    }
}
