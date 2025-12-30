import {eq} from 'drizzle-orm'
import type {DbExecutor} from '../db/client'
import {appSettings} from '../db/schema'
import type {AppSettingsRepo} from 'core/repos/interfaces'
import type {AppSettingsRow} from 'core/db/types'

const SINGLETON_ID = 'singleton'

export function createAppSettingsRepo(db: DbExecutor): AppSettingsRepo {
    return {
        async getAppSettingsRow(): Promise<AppSettingsRow | null> {
            const [row] = await db.select().from(appSettings).limit(1)
            return row ?? null
        },

        async insertDefaultAppSettings(): Promise<void> {
            await db.insert(appSettings).values({id: SINGLETON_ID}).run()
        },

        async updateAppSettingsRow(values: Partial<AppSettingsRow>): Promise<void> {
            await db.update(appSettings).set({...values, updatedAt: new Date()}).where(eq(appSettings.id, SINGLETON_ID)).run()
        },
    }
}
