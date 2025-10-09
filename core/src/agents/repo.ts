import {and, asc, eq} from 'drizzle-orm'
import {agentProfiles, type AgentProfile} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

export type AgentProfileInsert = typeof agentProfiles.$inferInsert
export type AgentProfileUpdate = Partial<typeof agentProfiles.$inferInsert>

export async function listAgentProfiles(projectId: string, executor?: DbExecutor): Promise<AgentProfile[]> {
    const database = resolveDb(executor)
    return database
        .select()
        .from(agentProfiles)
        .where(eq(agentProfiles.projectId, projectId))
        .orderBy(asc(agentProfiles.createdAt))
}

export async function getAgentProfile(projectId: string, id: string, executor?: DbExecutor): Promise<AgentProfile | null> {
    const database = resolveDb(executor)
    const [row] = await database
        .select()
        .from(agentProfiles)
        .where(and(eq(agentProfiles.projectId, projectId), eq(agentProfiles.id, id)))
        .limit(1)
    return row ?? null
}

export async function insertAgentProfile(values: AgentProfileInsert, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.insert(agentProfiles).values(values).run()
}

export async function updateAgentProfileRow(
    projectId: string,
    id: string,
    patch: AgentProfileUpdate,
    executor?: DbExecutor,
): Promise<void> {
    const database = resolveDb(executor)
    await database
        .update(agentProfiles)
        .set(patch)
        .where(and(eq(agentProfiles.projectId, projectId), eq(agentProfiles.id, id)))
        .run()
}

export async function deleteAgentProfile(projectId: string, id: string, executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database
        .delete(agentProfiles)
        .where(and(eq(agentProfiles.projectId, projectId), eq(agentProfiles.id, id)))
        .run()
}
