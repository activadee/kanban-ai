import {and, eq} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {agentProfiles, agentProfilesGlobal} from '../db/schema'
import type {AgentProfilesRepo, AgentProfilesGlobalRepo, AgentProfileUpdate, AgentProfileGlobalUpdate} from 'core/repos/interfaces'
import type {
    AgentProfileRow,
    AgentProfileInsert,
    AgentProfileGlobalRow,
    AgentProfileGlobalInsert,
} from 'core/db/types'

export function createAgentProfilesRepo(db: BunSQLiteDatabase): AgentProfilesRepo {
    return {
        async listAgentProfiles(projectId: string): Promise<AgentProfileRow[]> {
            return db.select().from(agentProfiles).where(eq(agentProfiles.projectId, projectId))
        },

        async getAgentProfile(projectId: string, id: string): Promise<AgentProfileRow | null> {
            const [row] = await db
                .select()
                .from(agentProfiles)
                .where(and(eq(agentProfiles.projectId, projectId), eq(agentProfiles.id, id)))
                .limit(1)
            return row ?? null
        },

        async insertAgentProfile(values: AgentProfileInsert): Promise<void> {
            await db.insert(agentProfiles).values(values).run()
        },

        async updateAgentProfileRow(projectId: string, id: string, patch: AgentProfileUpdate): Promise<void> {
            await db
                .update(agentProfiles)
                .set(patch)
                .where(and(eq(agentProfiles.projectId, projectId), eq(agentProfiles.id, id)))
                .run()
        },

        async deleteAgentProfile(projectId: string, id: string): Promise<void> {
            await db
                .delete(agentProfiles)
                .where(and(eq(agentProfiles.projectId, projectId), eq(agentProfiles.id, id)))
                .run()
        },
    }
}

export function createAgentProfilesGlobalRepo(db: BunSQLiteDatabase): AgentProfilesGlobalRepo {
    return {
        async listGlobalAgentProfiles(): Promise<AgentProfileGlobalRow[]> {
            return db.select().from(agentProfilesGlobal)
        },

        async getGlobalAgentProfile(id: string): Promise<AgentProfileGlobalRow | null> {
            const [row] = await db.select().from(agentProfilesGlobal).where(eq(agentProfilesGlobal.id, id)).limit(1)
            return row ?? null
        },

        async insertGlobalAgentProfile(values: AgentProfileGlobalInsert): Promise<void> {
            await db.insert(agentProfilesGlobal).values(values).run()
        },

        async updateGlobalAgentProfileRow(id: string, patch: AgentProfileGlobalUpdate): Promise<void> {
            await db.update(agentProfilesGlobal).set(patch).where(eq(agentProfilesGlobal.id, id)).run()
        },

        async deleteGlobalAgentProfile(id: string): Promise<void> {
            await db.delete(agentProfilesGlobal).where(eq(agentProfilesGlobal.id, id)).run()
        },
    }
}
