import {eq} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {projectSettings} from '../db/schema'
import type {ProjectSettingsRepo, ProjectSettingsUpdate} from 'core/repos/interfaces'
import type {ProjectSettingsRow, ProjectSettingsInsert} from 'core/db/types'

export function createProjectSettingsRepo(db: BunSQLiteDatabase): ProjectSettingsRepo {
    return {
        async getProjectSettingsRow(projectId: string): Promise<ProjectSettingsRow | null> {
            const [row] = await db.select().from(projectSettings).where(eq(projectSettings.projectId, projectId)).limit(1)
            return row ?? null
        },

        async insertProjectSettings(values: ProjectSettingsInsert): Promise<void> {
            await db.insert(projectSettings).values(values).run()
        },

        async updateProjectSettingsRow(projectId: string, patch: ProjectSettingsUpdate): Promise<void> {
            await db.update(projectSettings).set(patch).where(eq(projectSettings.projectId, projectId)).run()
        },
    }
}
