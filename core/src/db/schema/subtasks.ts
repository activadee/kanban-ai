import {sqliteTable, text, integer} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'
import {cards} from './projects'

export const subtasks = sqliteTable('subtasks', {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').notNull().references(() => cards.id, {onDelete: 'cascade'}),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('todo'),
    position: integer('position').notNull(),
    assigneeId: text('assignee_id'),
    dueDate: integer('due_date', {mode: 'timestamp'}),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type SubtaskRow = typeof subtasks.$inferSelect
export type SubtaskInsert = typeof subtasks.$inferInsert

