import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

export const onboardingState = sqliteTable('onboarding_state', {
    id: text('id').primaryKey().default('singleton'),
    status: text('status').notNull().default('pending'),
    lastStep: text('last_step'),
    completedAt: integer('completed_at', {mode: 'timestamp'}),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const githubAppConfigs = sqliteTable('github_app_configs', {
    id: text('id').primaryKey().default('singleton'),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type OnboardingStateRow = typeof onboardingState.$inferSelect
export type GithubAppConfigRow = typeof githubAppConfigs.$inferSelect
