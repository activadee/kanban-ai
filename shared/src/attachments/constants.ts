import type {ImageMimeType} from '../types/conversation'

export const MAX_IMAGES_PER_MESSAGE = 4
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_TOTAL_IMAGE_BYTES = MAX_IMAGES_PER_MESSAGE * MAX_IMAGE_BYTES

export const ALLOWED_IMAGE_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
] as const satisfies readonly ImageMimeType[]

export const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4
// Add slack for the "data:<mime>;base64," prefix and any minor variance.
export const MAX_IMAGE_DATA_URL_LENGTH = 64 + MAX_IMAGE_BASE64_LENGTH

export function imageDataUrlPrefix(mimeType: ImageMimeType): string {
    return `data:${mimeType};base64,`
}

export function estimateDecodedBytesFromDataUrl(dataUrl: string, base64PrefixLength: number): number {
    const base64Len = Math.max(0, dataUrl.length - base64PrefixLength)
    let padding = 0
    if (dataUrl.endsWith('==')) padding = 2
    else if (dataUrl.endsWith('=')) padding = 1
    const bytes = Math.floor((base64Len * 3) / 4) - padding
    return bytes < 0 ? 0 : bytes
}

