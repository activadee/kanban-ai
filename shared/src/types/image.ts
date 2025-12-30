import type {MessageImageMimeType} from './conversation'

export const SUPPORTED_IMAGE_MIME_TYPES: readonly MessageImageMimeType[] = [
    'image/png',
    'image/jpeg',
    'image/webp',
] as const

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export const MAX_IMAGES_PER_MESSAGE = 5

export function isValidImageMimeType(mime: string): mime is MessageImageMimeType {
    return SUPPORTED_IMAGE_MIME_TYPES.includes(mime as MessageImageMimeType)
}

export function getImageExtension(mime: MessageImageMimeType): string {
    switch (mime) {
        case 'image/png':
            return 'png'
        case 'image/jpeg':
            return 'jpg'
        case 'image/webp':
            return 'webp'
    }
}
