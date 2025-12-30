import type {CardEnhancementSuggestion} from 'shared'
import {withRepoTx} from '../repos/provider'
import {deleteCardEnhancement, listCardEnhancementsForBoard, upsertCardEnhancement} from '../projects/enhancements'
import {getCardById} from '../projects/repo'

export type CardEnhancementEntry = {
    status: 'enhancing' | 'ready'
    suggestion?: CardEnhancementSuggestion
}

function toIso(value: Date | string | number | null | undefined) {
    if (!value) return new Date().toISOString()
    if (value instanceof Date) return value.toISOString()
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

async function assertCardBelongsToBoard(cardId: string, boardId: string) {
    const card = await getCardById(cardId)
    if (!card || card.boardId !== boardId) {
        throw new Error('Card not found')
    }
}

export async function getCardEnhancements(boardId: string): Promise<Record<string, CardEnhancementEntry>> {
    const rows = await listCardEnhancementsForBoard(boardId)
    const map: Record<string, CardEnhancementEntry> = {}
    for (const row of rows) {
        map[row.cardId] = {
            status: row.status,
            suggestion:
                row.suggestionTitle || row.suggestionDescription
                    ? {
                          title: row.suggestionTitle ?? '',
                          description: row.suggestionDescription ?? '',
                      }
                    : undefined,
        }
    }
    return map
}

export async function setCardEnhancement(
    boardId: string,
    cardId: string,
    entry: CardEnhancementEntry,
): Promise<void> {
    await assertCardBelongsToBoard(cardId, boardId)
    await upsertCardEnhancement({
        cardId,
        status: entry.status,
        suggestionTitle: entry.suggestion?.title ?? null,
        suggestionDescription: entry.suggestion?.description ?? null,
        updatedAt: new Date(),
    })
}

export async function clearCardEnhancement(boardId: string, cardId: string): Promise<void> {
    await assertCardBelongsToBoard(cardId, boardId)
    await deleteCardEnhancement(cardId)
}
