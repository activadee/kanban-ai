import {getDependenciesRepo} from '../repos/provider'
import {getCardById, getColumnById, listCardsForBoard} from './repo'

export async function listDependencies(cardId: string): Promise<string[]> {
    return getDependenciesRepo().listDependencies(cardId)
}

export async function listDependenciesForCards(cardIds: string[]): Promise<Map<string, string[]>> {
    return getDependenciesRepo().listDependenciesForCards(cardIds)
}

export async function setDependencies(cardId: string, dependsOnIds: string[]): Promise<void> {
    const unique = Array.from(new Set(dependsOnIds.filter((id) => id && id !== cardId)))

    const resolveBoardId = async (id: string): Promise<string> => {
        const card = await getCardById(id)
        if (!card) throw new Error('card_not_found')
        if (card.boardId) return card.boardId
        const col = await getColumnById(card.columnId)
        if (!col?.boardId) throw new Error('board_not_found')
        return col.boardId
    }

    const boardId = await resolveBoardId(cardId)

    for (const depId of unique) {
        const depBoard = await resolveBoardId(depId)
        if (depBoard !== boardId) {
            const err = new Error('dependency_board_mismatch')
            ;(err as unknown as Record<string, unknown>).details = {depId, expectedBoard: boardId, actualBoard: depBoard}
            throw err
        }
    }

    const allCards = await listCardsForBoard(boardId)
    const allIds = allCards.map((c) => c.id)
    const existing = await listDependenciesForCards(allIds)
    const graph = new Map<string, string[]>()
    for (const id of allIds) graph.set(id, existing.get(id) ?? [])
    graph.set(cardId, unique)

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
        ;(err as unknown as Record<string, unknown>).details = {cardId, dependsOn: unique}
        throw err
    }

    await getDependenciesRepo().deleteDependencies(cardId)
    if (unique.length > 0) {
        await getDependenciesRepo().insertDependencies(cardId, unique)
    }
}

export async function isCardBlocked(cardId: string): Promise<{blocked: boolean; incompleteDependencyIds: string[]}> {
    const deps = await listDependencies(cardId)
    if (deps.length === 0) return {blocked: false, incompleteDependencyIds: []}
    const incomplete: string[] = []
    for (const depId of deps) {
        const depCard = await getCardById(depId).catch(() => null)
        if (!depCard) {
            incomplete.push(depId)
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
