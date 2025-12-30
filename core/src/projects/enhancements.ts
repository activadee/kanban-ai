import {getEnhancementsRepo} from '../repos/provider'
import type {CardEnhancementRecord} from '../repos/interfaces'

export type EnhancementStatus = 'enhancing' | 'ready'
export type {CardEnhancementRecord}

export async function listCardEnhancementsForBoard(boardId: string): Promise<CardEnhancementRecord[]> {
    return getEnhancementsRepo().listCardEnhancementsForBoard(boardId)
}

export async function upsertCardEnhancement(record: CardEnhancementRecord): Promise<void> {
    return getEnhancementsRepo().upsertCardEnhancement(record)
}

export async function deleteCardEnhancement(cardId: string): Promise<void> {
    return getEnhancementsRepo().deleteCardEnhancement(cardId)
}
