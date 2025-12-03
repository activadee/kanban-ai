import {eq} from 'drizzle-orm'
import {projectSettings} from '../../db/schema'
import type {DbExecutor} from '../../db/with-tx'
import {resolveDb} from '../../db/with-tx'

export type ProjectSettingsInsert = typeof projectSettings.$inferInsert
export type ProjectSettingsUpdate = Partial<typeof projectSettings.$inferInsert>

export async function getProjectSettingsRow(projectId: string, executor?: DbExecutor) {
    const db = resolveDb(executor)
    const [row] = await db.select().from(projectSettings).where(eq(projectSettings.projectId, projectId)).limit(1)
    return row ?? null
}

export async function insertProjectSettings(values: ProjectSettingsInsert, executor?: DbExecutor) {
    const db = resolveDb(executor)
    await db.insert(projectSettings).values(values).run()
}

export async function updateProjectSettingsRow(projectId: string, patch: ProjectSettingsUpdate, executor?: DbExecutor) {
    const db = resolveDb(executor)
    await db.update(projectSettings).set(patch).where(eq(projectSettings.projectId, projectId)).run()
}
