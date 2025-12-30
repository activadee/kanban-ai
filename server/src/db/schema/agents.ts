import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

export const agentProfiles = sqliteTable('agent_profiles', {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    agent: text('agent').notNull(),
    name: text('name').notNull(),
    configJson: text('config_json').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const agentProfilesGlobal = sqliteTable('agent_profiles_global', {
    id: text('id').primaryKey(),
    agent: text('agent').notNull(),
    name: text('name').notNull(),
    configJson: text('config_json').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type AgentProfile = typeof agentProfiles.$inferSelect
export type AgentProfileInsert = typeof agentProfiles.$inferInsert

export type AgentProfileGlobal = typeof agentProfilesGlobal.$inferSelect
export type AgentProfileGlobalInsert = typeof agentProfilesGlobal.$inferInsert
