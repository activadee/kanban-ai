import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

export const attempts = sqliteTable('attempts', {
    id: text('id').primaryKey(),
    boardId: text('board_id').notNull(),
    cardId: text('card_id').notNull(),
    agent: text('agent').notNull(),
    status: text('status').notNull(),
    baseBranch: text('base_branch').notNull(),
    branchName: text('branch_name').notNull(),
    worktreePath: text('worktree_path'),
    sessionId: text('session_id'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    startedAt: integer('started_at', {mode: 'timestamp'}),
    endedAt: integer('ended_at', {mode: 'timestamp'}),
})

export const attemptLogs = sqliteTable('attempt_logs', {
    id: text('id').primaryKey(),
    attemptId: text('attempt_id').notNull(),
    ts: integer('ts', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    level: text('level').notNull(),
    message: text('message').notNull(),
})

export const conversationItems = sqliteTable('conversation_items', {
    id: text('id').primaryKey(),
    attemptId: text('attempt_id').notNull(),
    seq: integer('seq').notNull(),
    ts: integer('ts', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    itemJson: text('item_json').notNull(),
})

export type Attempt = typeof attempts.$inferSelect
export type AttemptLog = typeof attemptLogs.$inferSelect
export type ConversationItemRow = typeof conversationItems.$inferSelect

