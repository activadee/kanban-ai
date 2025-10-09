import {asc, eq, inArray} from 'drizzle-orm'
import {cardDependencies} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'
import {getCardById, getColumnById, listCardsForBoard} from './repo'

/** Return dependency card IDs that `cardId` depends on. */
export async function listDependencies(cardId: string, executor?: DbExecutor): Promise<string[]> {
    const db = resolveDb(executor)
    const rows = await db
        .select({dependsOnCardId: cardDependencies.dependsOnCardId})
        .from(cardDependencies)
        .where(eq(cardDependencies.cardId, cardId))
        .orderBy(asc(cardDependencies.dependsOnCardId))
    return (rows as Array<{ dependsOnCardId: string }>).map((r) => r.dependsOnCardId)
}

/** Return a map of cardId -> dependency IDs for a set of cards. */
export async function listDependenciesForCards(cardIds: string[], executor?: DbExecutor): Promise<Map<string, string[]>> {
    const db = resolveDb(executor)
    const result = new Map<string, string[]>()
    if (cardIds.length === 0) return result
    const rows = await db
        .select({cardId: cardDependencies.cardId, dependsOnCardId: cardDependencies.dependsOnCardId})
        .from(cardDependencies)
        .where(inArray(cardDependencies.cardId, cardIds))
        .orderBy(asc(cardDependencies.cardId), asc(cardDependencies.dependsOnCardId))
    for (const row of rows as Array<{ cardId: string; dependsOnCardId: string }>) {
        const list = result.get(row.cardId) ?? []
        list.push(row.dependsOnCardId)
        result.set(row.cardId, list)
    }
    return result
}

/** Replace all dependencies for a card with the provided set. */
export async function setDependencies(cardId: string, dependsOnIds: string[], executor?: DbExecutor): Promise<void> {
    const db = resolveDb(executor)
    const unique = Array.from(new Set(dependsOnIds.filter((id) => id && id !== cardId)))

    // Resolve board of the target card
    const resolveBoardId = async (id: string): Promise<string> => {
        const card = await getCardById(id, executor)
        if (!card) throw new Error('card_not_found')
        if (card.boardId) return card.boardId
        const col = await getColumnById(card.columnId, executor)
        if (!col?.boardId) throw new Error('board_not_found')
        return col.boardId
    }

    const boardId = await resolveBoardId(cardId)

    // Ensure all dependencies are on the same board
    for (const depId of unique) {
        const depBoard = await resolveBoardId(depId)
        if (depBoard !== boardId) {
            const err = new Error('dependency_board_mismatch')
            ;(err as any).details = {depId, expectedBoard: boardId, actualBoard: depBoard}
            throw err
        }
    }

    // Prevent cycles: build adjacency for this board and validate
    const allCards = await listCardsForBoard(boardId, executor)
    const allIds = allCards.map((c) => c.id)
    const existing = await listDependenciesForCards(allIds, executor)
    const graph = new Map<string, string[]>()
    for (const id of allIds) graph.set(id, existing.get(id) ?? [])
    graph.set(cardId, unique) // apply proposed deps

    const seen = new Set<string>()
    const stack = new Set<string>()
    const hasCycleFrom = (id: string): boolean => {
        if (stack.has(id)) return true
        if (seen.has(id)) return false
        seen.add(id)
        stack.add(id)
        const next = graph.get(id) ?? []
        for (const n of next) {
            if (hasCycleFrom(n)) return true
        }
        stack.delete(id)
        return false
    }
    if (hasCycleFrom(cardId)) {
        const err = new Error('dependency_cycle')
        ;(err as any).details = {cardId, dependsOn: unique}
        throw err
    }

    // Persist changes
    await db.delete(cardDependencies).where(eq(cardDependencies.cardId, cardId)).run()
    if (unique.length === 0) return
    const values = unique.map((depId) => ({cardId, dependsOnCardId: depId}))
    await db.insert(cardDependencies).values(values).run()
}

/** Determine if a card is blocked by any dependency not in the Done column. */
export async function isCardBlocked(cardId: string): Promise<{ blocked: boolean; incompleteDependencyIds: string[] }> {
    const deps = await listDependencies(cardId)
    if (deps.length === 0) return {blocked: false, incompleteDependencyIds: []}
    const incomplete: string[] = []
    for (const depId of deps) {
        const depCard = await getCardById(depId).catch(() => null)
        if (!depCard) {
            incomplete.push(depId);
            continue
        }
        const column = await getColumnById(depCard.columnId).catch(() => null)
        const title = (column?.title ?? '').trim().toLowerCase()
        if (!column || title !== 'done') {
            incomplete.push(depId)
        }
    }
    return {blocked: incomplete.length > 0, incompleteDependencyIds: incomplete}
}
