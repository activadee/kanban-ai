import {and, eq} from 'drizzle-orm'
import {cardEnhancements, cards, columns} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

export type EnhancementStatus = 'enhancing' | 'ready'

export type CardEnhancementRecord = {
    cardId: string
    status: EnhancementStatus
    suggestionTitle?: string | null
    suggestionDescription?: string | null
    updatedAt: Date | number | string
}

export async function listCardEnhancementsForBoard(boardId: string, executor?: DbExecutor): Promise<CardEnhancementRecord[]> {
    const database = resolveDb(executor)
    const rows = await database
        .select({
            cardId: cardEnhancements.cardId,
            status: cardEnhancements.status,
            suggestionTitle: cardEnhancements.suggestionTitle,
            suggestionDescription: cardEnhancements.suggestionDescription,
            updatedAt: cardEnhancements.updatedAt,
        })
        .from(cardEnhancements)
        .innerJoin(cards, eq(cardEnhancements.cardId, cards.id))
        .innerJoin(columns, eq(cards.columnId, columns.id))
        .where(eq(columns.boardId, boardId))

    return rows
}

export async function upsertCardEnhancement(
    record: CardEnhancementRecord,
    executor?: DbExecutor,
): Promise<void> {
    const database = resolveDb(executor)
    await database
        .insert(cardEnhancements)
        .values({
            cardId: record.cardId,
            status: record.status,
            suggestionTitle: record.suggestionTitle,
            suggestionDescription: record.suggestionDescription,
            updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
            target: cardEnhancements.cardId,
            set: {
                status: record.status,
                suggestionTitle: record.suggestionTitle,
                suggestionDescription: record.suggestionDescription,
                updatedAt: record.updatedAt,
            },
        })
}

export async function deleteCardEnhancement(cardId: string, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.delete(cardEnhancements).where(eq(cardEnhancements.cardId, cardId)).run()
}
