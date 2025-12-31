import {getCardImagesRepo} from './provider'
import type {CardImagesRow} from '../db/types'

export async function getCardImages(cardId: string): Promise<CardImagesRow | null> {
    return getCardImagesRepo().getCardImages(cardId)
}

export async function setCardImages(cardId: string, imagesJson: string): Promise<void> {
    return getCardImagesRepo().setCardImages(cardId, imagesJson)
}

export async function deleteCardImages(cardId: string): Promise<void> {
    return getCardImagesRepo().deleteCardImages(cardId)
}
