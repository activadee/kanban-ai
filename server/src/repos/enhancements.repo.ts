import {eq, inArray} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {cardEnhancements, cards} from '../db/schema'
import type {EnhancementsRepo, CardEnhancementRecord} from 'core/repos/interfaces'

export function createEnhancementsRepo(db: BunSQLiteDatabase): EnhancementsRepo {
    return {
        async listCardEnhancementsForBoard(boardId: string): Promise<CardEnhancementRecord[]> {
            const boardCards = await db.select({id: cards.id}).from(cards).where(eq(cards.boardId, boardId))
            if (boardCards.length === 0) return []
            const cardIds = boardCards.map((c) => c.id)

            const rows = await db.select().from(cardEnhancements).where(inArray(cardEnhancements.cardId, cardIds))
            return rows.map((row) => ({
                cardId: row.cardId,
                status: row.status,
                suggestionTitle: row.suggestionTitle,
                suggestionDescription: row.suggestionDescription,
                updatedAt: row.updatedAt,
            }))
        },

        async upsertCardEnhancement(record: CardEnhancementRecord): Promise<void> {
            await db
                .insert(cardEnhancements)
                .values({
                    cardId: record.cardId,
                    status: record.status,
                    suggestionTitle: record.suggestionTitle ?? null,
                    suggestionDescription: record.suggestionDescription ?? null,
                    updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
                })
                .onConflictDoUpdate({
                    target: cardEnhancements.cardId,
                    set: {
                        status: record.status,
                        suggestionTitle: record.suggestionTitle ?? null,
                        suggestionDescription: record.suggestionDescription ?? null,
                        updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
                    },
                })
                .run()
        },

        async deleteCardEnhancement(cardId: string): Promise<void> {
            await db.delete(cardEnhancements).where(eq(cardEnhancements.cardId, cardId)).run()
        },
    }
}
