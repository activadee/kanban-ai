import {sqliteTable, text, integer} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'
import {cards} from './projects'

export const cardEnhancements = sqliteTable('card_enhancements', {
    cardId: text('card_id').primaryKey().references(() => cards.id, {onDelete: 'cascade'}),
    status: text('status', {enum: ['enhancing', 'ready']}).notNull(),
    suggestionTitle: text('suggestion_title'),
    suggestionDescription: text('suggestion_description'),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type CardEnhancementRow = typeof cardEnhancements.$inferSelect
