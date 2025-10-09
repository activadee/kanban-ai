import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

export const githubConnections = sqliteTable('github_connections', {
    id: text('id').primaryKey(),
    username: text('username'),
    primaryEmail: text('primary_email'),
    accessToken: text('access_token'),
    tokenType: text('token_type'),
    scope: text('scope'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const githubIssues = sqliteTable('github_issues', {
    id: text('id').primaryKey(),
    boardId: text('board_id').notNull(),
    cardId: text('card_id').notNull(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    issueId: text('issue_id').notNull(),
    issueNumber: integer('issue_number').notNull(),
    titleSnapshot: text('title_snapshot').notNull(),
    url: text('url').notNull(),
    state: text('state').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})
export type GithubConnection = typeof githubConnections.$inferSelect
