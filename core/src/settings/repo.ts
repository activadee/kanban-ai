import {eq} from 'drizzle-orm'
import {db} from '../db/client'
import {appSettings, type AppSettingsRow} from '../db/schema/app'

export async function getAppSettingsRow(): Promise<AppSettingsRow | null> {
    const rows = await db.select().from(appSettings).limit(1)
    return rows[0] ?? null
}

export async function insertDefaultAppSettings(): Promise<void> {
    await db.insert(appSettings).values({id: 'singleton'}).onConflictDoNothing().run()
}

export async function updateAppSettingsRow(values: Partial<AppSettingsRow>): Promise<void> {
    await db.update(appSettings).set({...values, updatedAt: new Date()}).where(eq(appSettings.id, 'singleton')).run()
}
