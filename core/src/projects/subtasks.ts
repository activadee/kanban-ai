import {asc, eq} from 'drizzle-orm'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb, withTx} from '../db/with-tx'
import {subtasks, type SubtaskRow} from '../db/schema'
import type {Subtask as SubtaskDto, SubtaskStatus, SubtaskProgress} from 'shared'
import {getCardById} from './repo'

function toIso(value: Date | string | number | null | undefined): string {
    if (!value) return new Date().toISOString()
    if (value instanceof Date) return value.toISOString()
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function mapRow(row: SubtaskRow): SubtaskDto {
    return {
        id: row.id,
        ticketId: row.ticketId,
        title: row.title,
        description: row.description ?? null,
        status: row.status as SubtaskStatus,
        position: row.position,
        assigneeId: row.assigneeId ?? null,
        dueDate: row.dueDate ? toIso(row.dueDate) : null,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

export function computeSubtaskProgress(items: Array<{ status: SubtaskStatus }>): SubtaskProgress {
    const total = items.length
    const done = items.filter((s) => s.status === 'done').length
    return {total, done}
}

export async function listSubtasks(ticketId: string, executor?: DbExecutor): Promise<SubtaskDto[]> {
    const db = resolveDb(executor)
    const rows = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.ticketId, ticketId))
        .orderBy(asc(subtasks.position))
    return (rows as SubtaskRow[]).map(mapRow)
}

export async function getSubtaskById(id: string, executor?: DbExecutor): Promise<SubtaskRow | null> {
    const db = resolveDb(executor)
    const [row] = await db.select().from(subtasks).where(eq(subtasks.id, id)).limit(1)
    return (row as SubtaskRow | undefined) ?? null
}

async function getNextPosition(ticketId: string, executor?: DbExecutor): Promise<number> {
    const db = resolveDb(executor)
    const rows = await db
        .select({position: subtasks.position})
        .from(subtasks)
        .where(eq(subtasks.ticketId, ticketId))
        .orderBy(asc(subtasks.position))
    const positions = (rows as Array<{ position: number | null }>).map((r) => r.position ?? -1)
    if (positions.length === 0) return 0
    return Math.max(...positions) + 1
}

export async function createSubtask(
    ticketId: string,
    input: { title: string; description?: string | null; status?: SubtaskStatus; assigneeId?: string | null; dueDate?: string | null },
): Promise<SubtaskDto> {
    let createdId: string | null = null
    await withTx(async (tx) => {
        const card = await getCardById(ticketId, tx)
        if (!card) {
            const err = new Error('ticket_not_found')
            ;(err as any).details = {ticketId}
            throw err
        }
        const now = new Date()
        const position = await getNextPosition(ticketId, tx)
        const id = `subtask-${crypto.randomUUID()}`
        await resolveDb(tx)
            .insert(subtasks)
            .values({
                id,
                ticketId,
                title: input.title,
                description: input.description ?? null,
                status: (input.status ?? 'todo') as string,
                position,
                assigneeId: input.assigneeId ?? null,
                dueDate: input.dueDate ? new Date(input.dueDate) : null,
                createdAt: now,
                updatedAt: now,
            })
            .run()
        createdId = id
    })

    if (!createdId) {
        throw new Error('subtask_create_failed')
    }
    const row = await getSubtaskById(createdId)
    if (!row) {
        throw new Error('subtask_not_found')
    }
    return mapRow(row)
}

export async function updateSubtask(
    subtaskId: string,
    patch: { title?: string; description?: string | null; status?: SubtaskStatus; assigneeId?: string | null; dueDate?: string | null },
): Promise<SubtaskDto | null> {
    const db = resolveDb()
    const existing = await getSubtaskById(subtaskId)
    if (!existing) return null

    const update: Partial<SubtaskRow> = {
        updatedAt: new Date(),
    }
    if (patch.title !== undefined) update.title = patch.title
    if (patch.description !== undefined) update.description = patch.description ?? null
    if (patch.status !== undefined) update.status = patch.status
    if (patch.assigneeId !== undefined) update.assigneeId = patch.assigneeId ?? null
    if (patch.dueDate !== undefined) update.dueDate = patch.dueDate ? new Date(patch.dueDate) : null

    await db.update(subtasks).set(update).where(eq(subtasks.id, subtaskId)).run()

    const row = await getSubtaskById(subtaskId)
    return row ? mapRow(row) : null
}

export async function deleteSubtask(subtaskId: string): Promise<void> {
    const db = resolveDb()
    await db.delete(subtasks).where(eq(subtasks.id, subtaskId)).run()
}

export async function listSubtasksWithProgress(
    ticketId: string,
    executor?: DbExecutor,
): Promise<{ subtasks: SubtaskDto[]; progress: SubtaskProgress }> {
    const items = await listSubtasks(ticketId, executor)
    const progress = computeSubtaskProgress(items)
    return {subtasks: items, progress}
}

export async function reorderSubtasks(ticketId: string, orderedIds: string[]): Promise<void> {
    await withTx(async (tx) => {
        const db = resolveDb(tx)
        const rows = await db
            .select({id: subtasks.id})
            .from(subtasks)
            .where(eq(subtasks.ticketId, ticketId))
            .orderBy(asc(subtasks.position))

        const existingIds = (rows as Array<{ id: string }>).map((r) => r.id)
        const uniqueOrdered = Array.from(new Set(orderedIds))

        const sameLength = uniqueOrdered.length === existingIds.length
        const sameSet =
            sameLength &&
            uniqueOrdered.every((id) => existingIds.includes(id)) &&
            existingIds.every((id) => uniqueOrdered.includes(id))

        if (!sameSet) {
            const err = new Error('invalid_subtask_order')
            ;(err as any).details = {ticketId, orderedIds, existingIds}
            throw err
        }

        const now = new Date()
        for (const [index, id] of uniqueOrdered.entries()) {
            await db.update(subtasks).set({position: index, updatedAt: now}).where(eq(subtasks.id, id)).run()
        }
    })
}

