import {sqliteTable, text, integer, uniqueIndex} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'
import {cards} from './projects'

export const cardDependencies = sqliteTable(
    'card_dependencies',
    {
        cardId: text('card_id').notNull().references(() => cards.id, {onDelete: 'cascade'}),
        dependsOnCardId: text('depends_on_card_id').notNull().references(() => cards.id, {onDelete: 'cascade'}),
        createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => ({
        uniq: uniqueIndex('card_deps_unique').on(t.cardId, t.dependsOnCardId),
    }),
)

export type CardDependency = typeof cardDependencies.$inferSelect

