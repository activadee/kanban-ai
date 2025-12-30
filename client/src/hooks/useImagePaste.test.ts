import {describe, expect, it, vi, beforeEach} from 'vitest'
import {renderHook, act} from '@testing-library/react'
import {useImagePaste} from './useImagePaste'
import {MAX_IMAGE_SIZE_BYTES, MAX_IMAGES_PER_MESSAGE} from 'shared'

const createMockFile = (name: string, type: string, size: number): File => {
    const content = new Uint8Array(size)
    return new File([content], name, {type})
}

const createValidPngFile = (name = 'test.png', size = 1024): File => {
    return createMockFile(name, 'image/png', size)
}

const createValidJpegFile = (name = 'test.jpg', size = 1024): File => {
    return createMockFile(name, 'image/jpeg', size)
}

describe('useImagePaste', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initializes with empty pending images', () => {
        const {result} = renderHook(() => useImagePaste())
        expect(result.current.pendingImages).toEqual([])
        expect(result.current.canAddMore).toBe(true)
    })

    it('adds valid PNG images', async () => {
        const {result} = renderHook(() => useImagePaste())
        const file = createValidPngFile()

        await act(async () => {
            const errors = await result.current.addImages([file])
            expect(errors).toEqual([])
        })

        expect(result.current.pendingImages).toHaveLength(1)
        expect(result.current.pendingImages[0].mime).toBe('image/png')
        expect(result.current.pendingImages[0].name).toBe('test.png')
    })

    it('adds valid JPEG images', async () => {
        const {result} = renderHook(() => useImagePaste())
        const file = createValidJpegFile()

        await act(async () => {
            const errors = await result.current.addImages([file])
            expect(errors).toEqual([])
        })

        expect(result.current.pendingImages).toHaveLength(1)
        expect(result.current.pendingImages[0].mime).toBe('image/jpeg')
    })

    it('rejects unsupported image formats', async () => {
        const {result} = renderHook(() => useImagePaste())
        const gifFile = createMockFile('test.gif', 'image/gif', 1024)

        await act(async () => {
            const errors = await result.current.addImages([gifFile])
            expect(errors).toHaveLength(1)
            expect(errors[0].type).toBe('invalid_format')
        })

        expect(result.current.pendingImages).toHaveLength(0)
    })

    it('rejects images exceeding size limit', async () => {
        const {result} = renderHook(() => useImagePaste())
        const largeFile = createValidPngFile('large.png', MAX_IMAGE_SIZE_BYTES + 1)

        await act(async () => {
            const errors = await result.current.addImages([largeFile])
            expect(errors).toHaveLength(1)
            expect(errors[0].type).toBe('too_large')
        })

        expect(result.current.pendingImages).toHaveLength(0)
    })

    it('enforces maximum images per message limit', async () => {
        const {result} = renderHook(() => useImagePaste())
        const files = Array.from({length: MAX_IMAGES_PER_MESSAGE + 2}, (_, i) =>
            createValidPngFile(`test${i}.png`)
        )

        await act(async () => {
            const errors = await result.current.addImages(files)
            expect(errors.some((e) => e.type === 'too_many')).toBe(true)
        })

        expect(result.current.pendingImages).toHaveLength(MAX_IMAGES_PER_MESSAGE)
        expect(result.current.canAddMore).toBe(false)
    })

    it('removes image by index', async () => {
        const {result} = renderHook(() => useImagePaste())
        const file1 = createValidPngFile('first.png')
        const file2 = createValidPngFile('second.png')

        await act(async () => {
            await result.current.addImages([file1, file2])
        })

        expect(result.current.pendingImages).toHaveLength(2)

        act(() => {
            result.current.removeImage(0)
        })

        expect(result.current.pendingImages).toHaveLength(1)
        expect(result.current.pendingImages[0].name).toBe('second.png')
    })

    it('clears all images', async () => {
        const {result} = renderHook(() => useImagePaste())
        const file1 = createValidPngFile('first.png')
        const file2 = createValidPngFile('second.png')

        await act(async () => {
            await result.current.addImages([file1, file2])
        })

        expect(result.current.pendingImages).toHaveLength(2)

        act(() => {
            result.current.clearImages()
        })

        expect(result.current.pendingImages).toHaveLength(0)
        expect(result.current.canAddMore).toBe(true)
    })

    it('respects custom max images limit', async () => {
        const customMax = 2
        const {result} = renderHook(() => useImagePaste(customMax))
        const files = [
            createValidPngFile('a.png'),
            createValidPngFile('b.png'),
            createValidPngFile('c.png'),
        ]

        await act(async () => {
            const errors = await result.current.addImages(files)
            expect(errors.some((e) => e.type === 'too_many')).toBe(true)
        })

        expect(result.current.pendingImages).toHaveLength(customMax)
    })

    it('handles multiple batches of images', async () => {
        const {result} = renderHook(() => useImagePaste(3))

        await act(async () => {
            await result.current.addImages([createValidPngFile('a.png')])
        })
        expect(result.current.pendingImages).toHaveLength(1)

        await act(async () => {
            await result.current.addImages([createValidPngFile('b.png')])
        })
        expect(result.current.pendingImages).toHaveLength(2)

        await act(async () => {
            await result.current.addImages([createValidPngFile('c.png')])
        })
        expect(result.current.pendingImages).toHaveLength(3)
        expect(result.current.canAddMore).toBe(false)
    })

    it('returns too_many error when adding more than remaining slots', async () => {
        const {result} = renderHook(() => useImagePaste(2))

        await act(async () => {
            const errors = await result.current.addImages([
                createValidPngFile('a.png'),
                createValidPngFile('b.png'),
                createValidPngFile('c.png'),
            ])
            expect(errors.some((e) => e.type === 'too_many')).toBe(true)
        })
        expect(result.current.pendingImages).toHaveLength(2)
    })

    it('handles mixed valid and invalid files', async () => {
        const {result} = renderHook(() => useImagePaste())
        const validFile = createValidPngFile('valid.png')
        const invalidFile = createMockFile('invalid.gif', 'image/gif', 1024)

        await act(async () => {
            const errors = await result.current.addImages([validFile, invalidFile])
            expect(errors).toHaveLength(1)
            expect(errors[0].type).toBe('invalid_format')
        })

        expect(result.current.pendingImages).toHaveLength(1)
        expect(result.current.pendingImages[0].name).toBe('valid.png')
    })

    it('supports WebP format', async () => {
        const {result} = renderHook(() => useImagePaste())
        const webpFile = createMockFile('test.webp', 'image/webp', 1024)

        await act(async () => {
            const errors = await result.current.addImages([webpFile])
            expect(errors).toEqual([])
        })

        expect(result.current.pendingImages).toHaveLength(1)
        expect(result.current.pendingImages[0].mime).toBe('image/webp')
    })
})
