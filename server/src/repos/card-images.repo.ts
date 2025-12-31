import {eq} from 'drizzle-orm'
import type {DbExecutor} from '../db/client'
import {cardImages} from '../db/schema'
import type {CardImagesRepo} from 'core/repos/interfaces'
import type {CardImagesRow} from 'core/db/types'

export function createCardImagesRepo(db: DbExecutor): CardImagesRepo {
    return {
        async getCardImages(cardId: string): Promise<CardImagesRow | null> {
            const [row] = await db
                .select()
                .from(cardImages)
                .where(eq(cardImages.cardId, cardId))
                .limit(1)
            return row ?? null
        },

        async setCardImages(cardId: string, imagesJson: string): Promise<void> {
            await db
                .insert(cardImages)
                .values({cardId, imagesJson})
                .onConflictDoUpdate({
                    target: cardImages.cardId,
                    set: {imagesJson},
                })
                .run()
        },

        async deleteCardImages(cardId: string): Promise<void> {
            await db.delete(cardImages).where(eq(cardImages.cardId, cardId)).run()
        },
    }
}
