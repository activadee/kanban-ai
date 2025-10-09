import {asc, eq} from 'drizzle-orm'
import {agentProfilesGlobal, type AgentProfileGlobal} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

export type GlobalAgentProfileInsert = typeof agentProfilesGlobal.$inferInsert
export type GlobalAgentProfileUpdate = Partial<typeof agentProfilesGlobal.$inferInsert>

export async function listGlobalAgentProfiles(executor?: DbExecutor): Promise<AgentProfileGlobal[]> {
    const database = resolveDb(executor)
    return database.select().from(agentProfilesGlobal).orderBy(asc(agentProfilesGlobal.createdAt))
}

export async function getGlobalAgentProfile(id: string, executor?: DbExecutor): Promise<AgentProfileGlobal | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(agentProfilesGlobal).where(eq(agentProfilesGlobal.id, id)).limit(1)
    return row ?? null
}

export async function insertGlobalAgentProfile(values: GlobalAgentProfileInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.insert(agentProfilesGlobal).values(values).run()
}

export async function updateGlobalAgentProfileRow(id: string, patch: GlobalAgentProfileUpdate, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.update(agentProfilesGlobal).set(patch).where(eq(agentProfilesGlobal.id, id)).run()
}

export async function deleteGlobalAgentProfile(id: string, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.delete(agentProfilesGlobal).where(eq(agentProfilesGlobal.id, id)).run()
}
