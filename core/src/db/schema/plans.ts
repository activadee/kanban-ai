import {integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'
import {attempts} from './attempts'
import {boards, cards} from './projects'

export const cardPlans = sqliteTable(
    'card_plans',
    {
        id: text('id').primaryKey(),
        cardId: text('card_id').notNull().references(() => cards.id, {onDelete: 'cascade'}),
        boardId: text('board_id').notNull().references(() => boards.id, {onDelete: 'cascade'}),
        planMarkdown: text('plan_markdown').notNull(),
        sourceMessageId: text('source_message_id'),
        sourceAttemptId: text('source_attempt_id').references(() => attempts.id, {onDelete: 'set null'}),
        createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => ({
        uniqueCardId: uniqueIndex('card_plans_card_id_unique').on(t.cardId),
    }),
)

export type CardPlanRow = typeof cardPlans.$inferSelect

