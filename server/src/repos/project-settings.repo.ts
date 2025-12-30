import {and, eq, ne, or, isNull, lt} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {projectSettings} from '../db/schema'
import type {ProjectSettingsRepo, ProjectSettingsUpdate, GithubIssueSyncStatus, GithubPrAutoCloseStatus} from 'core/repos/interfaces'
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

        async tryStartGithubIssueSync(projectId: string, now: Date, staleCutoff: Date): Promise<boolean> {
            const result = await db
                .update(projectSettings)
                .set({
                    lastGithubIssueSyncAt: now,
                    lastGithubIssueSyncStatus: 'running',
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(projectSettings.projectId, projectId),
                        or(
                            ne(projectSettings.lastGithubIssueSyncStatus, 'running'),
                            isNull(projectSettings.lastGithubIssueSyncAt),
                            lt(projectSettings.lastGithubIssueSyncAt, staleCutoff),
                        ),
                    ),
                )
                .run()
            const changes = (result as unknown as {changes?: number})?.changes ?? 0
            return changes > 0
        },

        async completeGithubIssueSync(projectId: string, status: Exclude<GithubIssueSyncStatus, 'running'>, now: Date): Promise<void> {
            await db
                .update(projectSettings)
                .set({
                    lastGithubIssueSyncAt: now,
                    lastGithubIssueSyncStatus: status,
                    updatedAt: now,
                })
                .where(eq(projectSettings.projectId, projectId))
                .run()
        },

        async tryStartGithubPrAutoClose(projectId: string, now: Date, staleCutoff: Date): Promise<boolean> {
            const result = await db
                .update(projectSettings)
                .set({
                    lastGithubPrAutoCloseAt: now,
                    lastGithubPrAutoCloseStatus: 'running',
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(projectSettings.projectId, projectId),
                        or(
                            ne(projectSettings.lastGithubPrAutoCloseStatus, 'running'),
                            isNull(projectSettings.lastGithubPrAutoCloseAt),
                            lt(projectSettings.lastGithubPrAutoCloseAt, staleCutoff),
                        ),
                    ),
                )
                .run()
            const changes = (result as unknown as {changes?: number})?.changes ?? 0
            return changes > 0
        },

        async completeGithubPrAutoClose(projectId: string, status: Exclude<GithubPrAutoCloseStatus, 'running'>, now: Date): Promise<void> {
            await db
                .update(projectSettings)
                .set({
                    lastGithubPrAutoCloseAt: now,
                    lastGithubPrAutoCloseStatus: status,
                    updatedAt: now,
                })
                .where(eq(projectSettings.projectId, projectId))
                .run()
        },
    }
}
