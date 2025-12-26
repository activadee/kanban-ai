import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {renderHook, cleanup, act} from '@testing-library/react'
import {useLocalStorage} from '@/hooks/useLocalStorage'

describe('useLocalStorage Hook', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    describe('Basic Functionality', () => {
        it('returns initial value when localStorage is empty', () => {
            const {result} = renderHook(() => useLocalStorage('test-key', 'default-value'))
            const [value] = result.current

            expect(value).toBe('default-value')
        })

        it('returns stored value from localStorage', () => {
            localStorage.setItem('test-key', JSON.stringify('stored-value'))

            const {result} = renderHook(() => useLocalStorage('test-key', 'default-value'))
            const [value] = result.current

            expect(value).toBe('stored-value')
        })

        it('can update the value', () => {
            const {result} = renderHook(() => useLocalStorage('test-key', 'default-value'))
            const [, setValue] = result.current

            act(() => {
                setValue('new-value')
            })

            expect(result.current[0]).toBe('new-value')
            expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'))
        })

        it('persists updated value across re-renders', () => {
            const {result, rerender} = renderHook(() => useLocalStorage('test-key', 'default-value'))
            const [, setValue] = result.current

            act(() => {
                setValue('new-value')
            })

            // Re-render the hook
            rerender()

            expect(result.current[0]).toBe('new-value')
        })
    })

    describe('Error Handling', () => {
        it('handles localStorage errors gracefully', () => {
            // Mock localStorage to throw an error
            const originalGetItem = global.localStorage.getItem
            const originalSetItem = global.localStorage.setItem

            vi.spyOn(global.localStorage, 'getItem').mockImplementation(() => {
                throw new Error('localStorage error')
            })

            const {result} = renderHook(() => useLocalStorage('test-key', 'default-value'))
            const [value] = result.current

            expect(value).toBe('default-value')

            // Restore
            vi.spyOn(global.localStorage, 'getItem').mockImplementation(originalGetItem)
            vi.spyOn(global.localStorage, 'setItem').mockImplementation(originalSetItem)
        })

        it('handles invalid JSON in localStorage', () => {
            localStorage.setItem('test-key', 'invalid-json')

            const {result} = renderHook(() => useLocalStorage('test-key', 'default-value'))
            const [value] = result.current

            // Should return default value when JSON is invalid
            expect(value).toBe('default-value')
        })
    })

    describe('Type Safety', () => {
        it('works with string values', () => {
            const {result} = renderHook(() => useLocalStorage('string-key', 'default'))
            const [value, setValue] = result.current

            expect(typeof value).toBe('string')

            act(() => {
                setValue('updated')
            })

            expect(result.current[0]).toBe('updated')
        })

        it('works with boolean values', () => {
            const {result} = renderHook(() => useLocalStorage('bool-key', false))
            const [value, setValue] = result.current

            expect(typeof value).toBe('boolean')

            act(() => {
                setValue(true)
            })

            expect(result.current[0]).toBe(true)
        })

        it('works with object values', () => {
            const {result} = renderHook(() => useLocalStorage('object-key', {foo: 'bar'}))
            const [value, setValue] = result.current

            expect(typeof value).toBe('object')
            expect(value).toEqual({foo: 'bar'})

            act(() => {
                setValue({foo: 'baz'})
            })

            expect(result.current[0]).toEqual({foo: 'baz'})
        })

        it('works with array values', () => {
            const {result} = renderHook(() => useLocalStorage('array-key', [1, 2, 3]))
            const [value, setValue] = result.current

            expect(Array.isArray(value)).toBe(true)
            expect(value).toEqual([1, 2, 3])

            act(() => {
                setValue([4, 5, 6])
            })

            expect(result.current[0]).toEqual([4, 5, 6])
        })
    })

    describe('Functional Updates', () => {
        it('supports functional updates', () => {
            const {result} = renderHook(() => useLocalStorage('func-key', 10))
            const [, setValue] = result.current

            act(() => {
                setValue((prev: number) => prev + 5)
            })

            expect(result.current[0]).toBe(15)

            act(() => {
                setValue((prev: number) => prev * 2)
            })

            expect(result.current[0]).toBe(30)
        })
    })
})
