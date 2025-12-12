import {describe, expect, it} from 'vitest'

import {attemptMessageSchema} from '../src/attempts/attempts.schemas'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4

describe('attemptMessageSchema (image attachments)', () => {
    it('accepts prompt-only messages', () => {
        const result = attemptMessageSchema.safeParse({prompt: 'hi'})
        expect(result.success).toBe(true)
    })

    it('rejects empty prompt and no images', () => {
        const result = attemptMessageSchema.safeParse({prompt: ''})
        expect(result.success).toBe(false)
    })

    it('rejects more than 4 images', () => {
        const img = {
            mimeType: 'image/png' as const,
            dataUrl: 'data:image/png;base64,Zm9v',
            sizeBytes: 3,
        }
        const result = attemptMessageSchema.safeParse({
            prompt: '',
            images: [img, img, img, img, img],
        })
        expect(result.success).toBe(false)
    })

    it('rejects oversized image data URLs', () => {
        const bigPayload = 'A'.repeat(MAX_IMAGE_BASE64_LENGTH + 256)
        const dataUrl = `data:image/png;base64,${bigPayload}`
        const result = attemptMessageSchema.safeParse({
            prompt: '',
            images: [
                {
                    mimeType: 'image/png',
                    dataUrl,
                    sizeBytes: 1,
                },
            ],
        })
        expect(result.success).toBe(false)
    })
})

