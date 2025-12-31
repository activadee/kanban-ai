import {useCallback, useState} from 'react'
import type {MessageImage, MessageImageMimeType} from 'shared'
import {
    SUPPORTED_IMAGE_MIME_TYPES,
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGES_PER_MESSAGE,
    isValidImageMimeType,
} from 'shared'

export type ImageValidationError = {
    type: 'invalid_format' | 'too_large' | 'too_many'
    message: string
    file?: File
}

export type UseImagePasteResult = {
    pendingImages: MessageImage[]
    addImages: (files: File[]) => Promise<ImageValidationError[]>
    addImagesFromClipboard: (event: ClipboardEvent) => Promise<ImageValidationError[]>
    addImagesFromDataTransfer: (dataTransfer: DataTransfer) => Promise<ImageValidationError[]>
    removeImage: (index: number) => void
    clearImages: () => void
    canAddMore: boolean
}

async function fileToMessageImage(file: File): Promise<MessageImage> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1]
            if (!base64) {
                reject(new Error('Failed to read file as base64'))
                return
            }
            resolve({
                data: base64,
                mime: file.type as MessageImageMimeType,
                name: file.name || undefined,
            })
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })
}

function extractImageFiles(dataTransfer: DataTransfer): File[] {
    const files: File[] = []
    for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i]
        if (file && file.type.startsWith('image/')) {
            files.push(file)
        }
    }
    if (files.length === 0) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
            const item = dataTransfer.items[i]
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) files.push(file)
            }
        }
    }
    return files
}

export function useImagePaste(maxImages: number = MAX_IMAGES_PER_MESSAGE, existingCount: number = 0): UseImagePasteResult {
    const [pendingImages, setPendingImages] = useState<MessageImage[]>([])

    const totalCount = existingCount + pendingImages.length
    const canAddMore = totalCount < maxImages

    const addImages = useCallback(async (files: File[]): Promise<ImageValidationError[]> => {
        const errors: ImageValidationError[] = []
        const validImages: MessageImage[] = []

        for (const file of files) {
            if (!isValidImageMimeType(file.type)) {
                errors.push({
                    type: 'invalid_format',
                    message: `Unsupported format: ${file.type || 'unknown'}. Supported: ${SUPPORTED_IMAGE_MIME_TYPES.join(', ')}`,
                    file,
                })
                continue
            }

            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
                const maxMb = (MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0)
                errors.push({
                    type: 'too_large',
                    message: `File too large (${sizeMb}MB). Maximum: ${maxMb}MB`,
                    file,
                })
                continue
            }

            try {
                const image = await fileToMessageImage(file)
                validImages.push(image)
            } catch {
                errors.push({
                    type: 'invalid_format',
                    message: `Failed to read file: ${file.name}`,
                    file,
                })
            }
        }

        if (validImages.length > 0) {
            setPendingImages((prev) => {
                const remaining = maxImages - existingCount - prev.length
                if (remaining <= 0) {
                    errors.push({
                        type: 'too_many',
                        message: `Maximum ${maxImages} images allowed (${existingCount} saved + ${prev.length} pending)`,
                    })
                    return prev
                }
                const toAdd = validImages.slice(0, remaining)
                if (toAdd.length < validImages.length) {
                    errors.push({
                        type: 'too_many',
                        message: `Only ${toAdd.length} of ${validImages.length} images added. Maximum ${maxImages} images allowed (${existingCount} saved)`,
                    })
                }
                return [...prev, ...toAdd]
            })
        }

        return errors
    }, [maxImages, existingCount])

    const addImagesFromClipboard = useCallback(async (event: ClipboardEvent): Promise<ImageValidationError[]> => {
        if (!event.clipboardData) return []
        const files = extractImageFiles(event.clipboardData)
        if (files.length === 0) return []
        return addImages(files)
    }, [addImages])

    const addImagesFromDataTransfer = useCallback(async (dataTransfer: DataTransfer): Promise<ImageValidationError[]> => {
        const files = extractImageFiles(dataTransfer)
        if (files.length === 0) return []
        return addImages(files)
    }, [addImages])

    const removeImage = useCallback((index: number) => {
        setPendingImages((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const clearImages = useCallback(() => {
        setPendingImages([])
    }, [])

    return {
        pendingImages,
        addImages,
        addImagesFromClipboard,
        addImagesFromDataTransfer,
        removeImage,
        clearImages,
        canAddMore,
    }
}
