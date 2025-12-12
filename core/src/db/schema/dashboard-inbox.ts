import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

/**
 * Persists per-inbox-item read/unread state for the Mission Control dashboard.
 *
 * Inbox items are derived (currently from attempts) and identified by the
 * stable `InboxItem.id` field. This table stores user-managed read state
 * keyed by that id.
 */
export const dashboardInboxItems = sqliteTable('dashboard_inbox_items', {
    id: text('id').primaryKey(),
    isRead: integer('is_read', {mode: 'boolean'}).notNull().default(false),
    updatedAt: integer('updated_at', {mode: 'timestamp'})
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
})

export type DashboardInboxItemRow = typeof dashboardInboxItems.$inferSelect
