import {and, eq, inArray, sql} from 'drizzle-orm'
import type {DashboardInbox, InboxItem} from 'shared'
import {dashboardInboxItems} from '../db/schema/dashboard-inbox'
import {resolveDb, withTx} from '../db/with-tx'

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
    const ids = collectInboxIds(inbox)
    if (ids.length === 0) return new Map()
    const rows = await db
        .select({id: dashboardInboxItems.id, isRead: dashboardInboxItems.isRead})
        .from(dashboardInboxItems)
        .where(inArray(dashboardInboxItems.id, ids))
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
    const db = resolveDb(executor)
    await withTx(async (tx) => {
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
    })
}

export async function markDashboardInboxItemsRead(
    ids: string[],
    executor?: any,
): Promise<void> {
    if (ids.length === 0) return
    const db = resolveDb(executor)
    await withTx(async (tx) => {
        const existing = await tx
            .select({id: dashboardInboxItems.id})
            .from(dashboardInboxItems)
            .where(inArray(dashboardInboxItems.id, ids))
        const existingIds = new Set(existing.map((r: any) => r.id))
        const toInsert = ids.filter((id) => !existingIds.has(id))
        if (toInsert.length > 0) {
            await tx.insert(dashboardInboxItems).values(
                toInsert.map((id) => ({id, isRead: true})),
            )
        }
        await tx
            .update(dashboardInboxItems)
            .set({
                isRead: true,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(inArray(dashboardInboxItems.id, ids))
    })
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

