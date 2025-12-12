import {and, eq, inArray, sql} from 'drizzle-orm'
import type {DashboardInbox, InboxItem} from 'shared'
import {dashboardInboxItems} from '../db/schema/dashboard-inbox'
import {resolveDb, withTx} from '../db/with-tx'

const SQLITE_IN_CHUNK_SIZE = 900

function dedupeIds(ids: string[]): string[] {
    const seen = new Set<string>()
    const unique: string[] = []
    for (const id of ids) {
        if (!id) continue
        if (seen.has(id)) continue
        seen.add(id)
        unique.push(id)
    }
    return unique
}

function chunkIds<T>(ids: T[], size: number): T[][] {
    if (ids.length <= size) return [ids]
    const chunks: T[][] = []
    for (let i = 0; i < ids.length; i += size) {
        chunks.push(ids.slice(i, i + size))
    }
    return chunks
}

function collectInboxIds(inbox: DashboardInbox): string[] {
    const ids: string[] = []
    for (const item of inbox.review) ids.push(item.id)
    for (const item of inbox.failed) ids.push(item.id)
    for (const item of inbox.stuck) ids.push(item.id)
    return ids
}

export async function loadDashboardInboxReadMap(
    inbox: DashboardInbox,
    executor?: any,
): Promise<Map<string, boolean>> {
    const db = resolveDb(executor)
    const ids = dedupeIds(collectInboxIds(inbox))
    if (ids.length === 0) return new Map()
    const rows: Array<{id: string; isRead: boolean}> = []
    for (const chunk of chunkIds(ids, SQLITE_IN_CHUNK_SIZE)) {
        const part = await db
            .select({id: dashboardInboxItems.id, isRead: dashboardInboxItems.isRead})
            .from(dashboardInboxItems)
            .where(inArray(dashboardInboxItems.id, chunk))
        rows.push(...part)
    }
    const map = new Map<string, boolean>()
    for (const row of rows) {
        map.set(row.id, Boolean(row.isRead))
    }
    return map
}

export function attachReadStateToInbox(
    inbox: DashboardInbox,
    readMap: Map<string, boolean>,
): DashboardInbox {
    const apply = (items: InboxItem[]) =>
        items.map((item) => ({
            ...item,
            isRead: readMap.get(item.id) ?? false,
        }))
    return {
        ...inbox,
        review: apply(inbox.review),
        failed: apply(inbox.failed),
        stuck: apply(inbox.stuck),
    }
}

export async function setDashboardInboxItemRead(
    id: string,
    isRead: boolean,
    executor?: any,
): Promise<void> {
    const run = async (tx: any) => {
        const existing = await tx
            .select({id: dashboardInboxItems.id})
            .from(dashboardInboxItems)
            .where(eq(dashboardInboxItems.id, id))
            .limit(1)
        if (existing.length > 0) {
            await tx
                .update(dashboardInboxItems)
                .set({
                    isRead,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                })
                .where(eq(dashboardInboxItems.id, id))
        } else {
            await tx.insert(dashboardInboxItems).values({
                id,
                isRead,
            })
        }
    }

    if (executor) {
        const db = resolveDb(executor)
        await run(db)
        return
    }

    await withTx(run)
}

export async function markDashboardInboxItemsRead(
    ids: string[],
    executor?: any,
): Promise<void> {
    const uniqueIds = dedupeIds(ids)
    if (uniqueIds.length === 0) return

    const run = async (tx: any) => {
        const existingIds = new Set<string>()
        for (const chunk of chunkIds(uniqueIds, SQLITE_IN_CHUNK_SIZE)) {
            const existing = await tx
                .select({id: dashboardInboxItems.id})
                .from(dashboardInboxItems)
                .where(inArray(dashboardInboxItems.id, chunk))
            for (const row of existing) existingIds.add(row.id)
        }

        const toInsert = uniqueIds.filter((id) => !existingIds.has(id))
        for (const insertChunk of chunkIds(toInsert, SQLITE_IN_CHUNK_SIZE)) {
            if (insertChunk.length === 0) continue
            await tx.insert(dashboardInboxItems).values(
                insertChunk.map((id) => ({id, isRead: true})),
            )
        }

        for (const updateChunk of chunkIds(uniqueIds, SQLITE_IN_CHUNK_SIZE)) {
            await tx
                .update(dashboardInboxItems)
                .set({
                    isRead: true,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                })
                .where(inArray(dashboardInboxItems.id, updateChunk))
        }
    }

    if (executor) {
        const db = resolveDb(executor)
        await run(db)
        return
    }

    await withTx(run)
}

export async function markAllDashboardInboxItemsRead(
    executor?: any,
): Promise<number> {
    const db = resolveDb(executor)
    const result = await db
        .update(dashboardInboxItems)
        .set({isRead: true, updatedAt: sql`CURRENT_TIMESTAMP`})
        .where(and(eq(dashboardInboxItems.isRead, false), sql`1 = 1`))
    // Drizzle bun-sqlite returns changes on .run(). For update builder, try to read changes if present.
    return (result as any)?.changes ?? 0
}
