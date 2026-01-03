import {relations} from 'drizzle-orm'
import {integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'
import type {TicketType} from 'shared'

export const boards = sqliteTable('boards', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    repositoryPath: text('repository_path').notNull(),
    repositoryUrl: text('repository_url'),
    repositorySlug: text('repository_slug'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const projectSettings = sqliteTable('project_settings', {
    projectId: text('project_id').primaryKey().references(() => boards.id, {onDelete: 'cascade'}),
    baseBranch: text('base_branch').notNull().default('main'),
    preferredRemote: text('preferred_remote'),
    setupScript: text('setup_script'),
    devScript: text('dev_script'),
    cleanupScript: text('cleanup_script'),
    copyFiles: text('copy_files'),
    allowScriptsToFail: integer('allow_scripts_to_fail', {mode: 'boolean'}).notNull().default(false),
    allowCopyFilesToFail: integer('allow_copy_files_to_fail', {mode: 'boolean'}).notNull().default(false),
    allowSetupScriptToFail: integer('allow_setup_script_to_fail', {mode: 'boolean'}).notNull().default(false),
    allowDevScriptToFail: integer('allow_dev_script_to_fail', {mode: 'boolean'}).notNull().default(false),
    allowCleanupScriptToFail: integer('allow_cleanup_script_to_fail', {mode: 'boolean'}).notNull().default(false),
    defaultAgent: text('default_agent'),
    defaultProfileId: text('default_profile_id'),
    inlineAgent: text('inline_agent'),
    inlineProfileId: text('inline_profile_id'),
    inlineAgentProfileMappingJson: text('inline_agent_profile_mapping_json'),
    autoCommitOnFinish: integer('auto_commit_on_finish', {mode: 'boolean'}).notNull().default(false),
    autoPushOnAutocommit: integer('auto_push_on_autocommit', {mode: 'boolean'}).notNull().default(false),
    ticketPrefix: text('ticket_prefix').notNull().default('PRJ'),
    nextTicketNumber: integer('next_ticket_number').notNull().default(1),
    githubIssueSyncEnabled: integer('github_issue_sync_enabled', {mode: 'boolean'}).notNull().default(false),
    githubIssueSyncState: text('github_issue_sync_state').notNull().default('open'),
    githubIssueSyncIntervalMinutes: integer('github_issue_sync_interval_minutes').notNull().default(15),
    githubIssueAutoCreateEnabled: integer('github_issue_auto_create_enabled', {mode: 'boolean'}).notNull().default(false),
    autoCloseTicketOnPRMerge: integer('auto_close_ticket_on_pr_merge', {mode: 'boolean'}).notNull().default(false),
    autoCloseTicketOnIssueClose: integer('auto_close_ticket_on_issue_close', {mode: 'boolean'}).notNull().default(false),
    lastGithubPrAutoCloseAt: integer('last_github_pr_auto_close_at', {mode: 'timestamp'}),
    lastGithubPrAutoCloseStatus: text('last_github_pr_auto_close_status').notNull().default('idle'),
    lastGithubIssueAutoCloseAt: integer('last_github_issue_auto_close_at', {mode: 'timestamp'}),
    lastGithubIssueAutoCloseStatus: text('last_github_issue_auto_close_status').notNull().default('idle'),
    lastGithubIssueSyncAt: integer('last_github_issue_sync_at', {mode: 'timestamp'}),
    lastGithubIssueSyncStatus: text('last_github_issue_sync_status').notNull().default('idle'),
    enhancePrompt: text('enhance_prompt'),
    prSummaryPrompt: text('pr_summary_prompt'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const columns = sqliteTable('columns', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    order: integer('position').notNull(),
    boardId: text('board_id').notNull().references(() => boards.id, {onDelete: 'cascade'}),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const cards = sqliteTable(
    'cards',
    {
        id: text('id').primaryKey(),
        title: text('title').notNull(),
        description: text('description'),
        order: integer('position').notNull(),
        columnId: text('column_id').notNull().references(() => columns.id, {onDelete: 'cascade'}),
        boardId: text('board_id').references(() => boards.id, {onDelete: 'cascade'}),
        ticketKey: text('ticket_key'),
        ticketType: text('ticket_type').$type<TicketType | null>(),
        isEnhanced: integer('is_enhanced', {mode: 'boolean'}).notNull().default(false),
        prUrl: text('pr_url'),
        disableAutoCloseOnPRMerge: integer('disable_auto_close_on_pr_merge', {mode: 'boolean'})
            .notNull()
            .default(false),
        disableAutoCloseOnIssueClose: integer('disable_auto_close_on_issue_close', {mode: 'boolean'})
            .notNull()
            .default(false),
        createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
        uniqueTicketKey: uniqueIndex('cards_board_ticket_key_idx').on(table.boardId, table.ticketKey),
    }),
)

export const boardRelations = relations(boards, ({many}) => ({
    columns: many(columns),
}))

export const columnRelations = relations(columns, ({one, many}) => ({
    board: one(boards, {fields: [columns.boardId], references: [boards.id]}),
    cards: many(cards),
}))

export const cardImages = sqliteTable('card_images', {
    cardId: text('card_id').primaryKey().references(() => cards.id, {onDelete: 'cascade'}),
    imagesJson: text('images_json').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const cardRelations = relations(cards, ({one}) => ({
    column: one(columns, {fields: [cards.columnId], references: [columns.id]}),
    images: one(cardImages, {fields: [cards.id], references: [cardImages.cardId]}),
}))

export const cardImagesRelations = relations(cardImages, ({one}) => ({
    card: one(cards, {fields: [cardImages.cardId], references: [cards.id]}),
}))

export type Board = typeof boards.$inferSelect
export type ProjectSettingsRow = typeof projectSettings.$inferSelect
export type Column = typeof columns.$inferSelect
export type Card = typeof cards.$inferSelect
export type CardImagesRow = typeof cardImages.$inferSelect
