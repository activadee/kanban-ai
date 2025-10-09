import type {BoardState} from 'shared'

export function makeIsCardBlocked(state: BoardState): (cardId: string) => boolean {
    const doneColumnIds = Object.values(state.columns)
        .filter((c) => (c.key === 'done') || c.title.trim().toLowerCase() === 'done')
        .map((c) => c.id)
    const doneCardIds = new Set(doneColumnIds.flatMap((cid) => state.columns[cid]?.cardIds ?? []))
    return (cardId: string) => {
        const c = state.cards[cardId]
        const deps = c?.dependsOn ?? []
        if (deps.length === 0) return false
        for (const depId of deps) {
            if (!doneCardIds.has(depId)) return true
        }
        return false
    }
}

