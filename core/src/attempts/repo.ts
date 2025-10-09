import {and, asc, desc, eq, sql} from 'drizzle-orm'
import {
    attempts,
    attemptLogs,
    conversationItems,
    type Attempt,
    type AttemptLog,
    type ConversationItemRow
} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

export type AttemptInsert = typeof attempts.$inferInsert
export type AttemptUpdate = Partial<typeof attempts.$inferInsert>
export type AttemptLogInsert = typeof attemptLogs.$inferInsert
export type ConversationItemInsert = typeof conversationItems.$inferInsert

export async function getAttemptById(id: string, executor?: DbExecutor): Promise<Attempt | null> {
    const database = resolveDb(executor)
    const [row] = await (database as any).select().from(attempts).where(eq(attempts.id, id)).limit(1)
    return row ?? null
}

export async function getAttemptForCard(boardId: string, cardId: string, executor?: DbExecutor): Promise<Attempt | null> {
    const database = resolveDb(executor)
    const [row] = await (database as any)
        .select()
        .from(attempts)
        .where(and(eq(attempts.boardId, boardId), eq(attempts.cardId, cardId)))
        .orderBy(desc(attempts.createdAt))
        .limit(1)
    return row ?? null
}

export async function insertAttempt(values: AttemptInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await (database as any).insert(attempts).values(values).run()
}

export async function updateAttempt(id: string, patch: AttemptUpdate, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await (database as any).update(attempts).set(patch).where(eq(attempts.id, id)).run()
}

export async function listAttemptLogs(attemptId: string, executor?: DbExecutor): Promise<AttemptLog[]> {
    const database = resolveDb(executor)
    return (database as any).select().from(attemptLogs).where(eq(attemptLogs.attemptId, attemptId)).orderBy(asc(attemptLogs.ts))
}

export async function insertAttemptLog(values: AttemptLogInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await (database as any).insert(attemptLogs).values(values).run()
}

export async function listConversationItems(attemptId: string, executor?: DbExecutor): Promise<ConversationItemRow[]> {
    const database = resolveDb(executor)
    return (database as any)
        .select()
        .from(conversationItems)
        .where(eq(conversationItems.attemptId, attemptId))
        .orderBy(asc(conversationItems.seq), asc(conversationItems.ts))
}

export async function listConversationItemsDescending(
    attemptId: string,
    limit: number,
    executor?: DbExecutor,
): Promise<Array<{ itemJson: string }>> {
    const database = resolveDb(executor)
    return (database as any)
        .select({itemJson: conversationItems.itemJson})
        .from(conversationItems)
        .where(eq(conversationItems.attemptId, attemptId))
        .orderBy(desc(conversationItems.seq), desc(conversationItems.ts))
        .limit(limit)
}

export async function insertConversationItem(values: ConversationItemInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await (database as any).insert(conversationItems).values(values).run()
}

export async function getNextConversationSeq(attemptId: string, executor?: DbExecutor): Promise<number> {
    const database = resolveDb(executor)
    const [row] = await (database as any)
        .select({maxSeq: sql<number>`coalesce(max(${conversationItems.seq}), 0)`})
        .from(conversationItems)
        .where(eq(conversationItems.attemptId, attemptId))
    return (row?.maxSeq ?? 0) + 1
}

export async function getAttemptBoardId(attemptId: string, executor?: DbExecutor): Promise<string | null> {
    const database = resolveDb(executor)
    const [row] = await (database as any).select({boardId: attempts.boardId}).from(attempts).where(eq(attempts.id, attemptId)).limit(1)
    return row?.boardId ?? null
}

export async function listAttemptsForBoard(boardId: string, executor?: DbExecutor): Promise<Attempt[]> {
    const database = resolveDb(executor)
    return (database as any).select().from(attempts).where(eq(attempts.boardId, boardId)).orderBy(asc(attempts.createdAt))
}
