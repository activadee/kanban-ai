import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

export const appSettings = sqliteTable('app_settings', {
    id: text('id').primaryKey().default('singleton'),
    theme: text('theme').notNull().default('system'),
    language: text('language').notNull().default('browser'),
    telemetryEnabled: integer('telemetry_enabled', {mode: 'boolean'}).notNull().default(false),
    notifToastSounds: integer('notif_toast_sounds', {mode: 'boolean'}).notNull().default(false),
    notifDesktop: integer('notif_desktop', {mode: 'boolean'}).notNull().default(false),
    autoStartAgentOnInProgress: integer('auto_start_agent_on_in_progress', {mode: 'boolean'}).notNull().default(false),
    editorType: text('editor_type').notNull().default('VS_CODE'),
    editorCommand: text('editor_command'),
    gitUserName: text('git_user_name'),
    gitUserEmail: text('git_user_email'),
    branchTemplate: text('branch_template').notNull().default('{prefix}/{ticketKey}-{slug}'),
    ghPrTitleTemplate: text('gh_pr_title_template'),
    ghPrBodyTemplate: text('gh_pr_body_template'),
    ghAutolinkTickets: integer('gh_autolink_tickets', {mode: 'boolean'}).notNull().default(true),
    opencodePort: integer('opencode_port').notNull().default(4097),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type AppSettingsRow = typeof appSettings.$inferSelect
