import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSortOrder, setSortOrder, type CardSortOrder } from '@/lib/sortOrder'

describe('sortOrder', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    describe('getSortOrder', () => {
        it('returns "custom" when no value is stored', () => {
            const result = getSortOrder()
            expect(result).toBe('custom')
        })

        it('returns "newest-first" when that value is stored', () => {
            localStorage.setItem('kanban-board-sort-order', 'newest-first')
            const result = getSortOrder()
            expect(result).toBe('newest-first')
        })

        it('returns "oldest-first" when that value is stored', () => {
            localStorage.setItem('kanban-board-sort-order', 'oldest-first')
            const result = getSortOrder()
            expect(result).toBe('oldest-first')
        })

        it('returns "custom" when that value is stored', () => {
            localStorage.setItem('kanban-board-sort-order', 'custom')
            const result = getSortOrder()
            expect(result).toBe('custom')
        })

        it('returns "custom" when invalid value is stored', () => {
            localStorage.setItem('kanban-board-sort-order', 'invalid')
            const result = getSortOrder()
            expect(result).toBe('custom')
        })

        it('returns "custom" when localStorage throws an error', () => {
            // Mock localStorage.getItem to throw an error
            const originalGetItem = localStorage.getItem
            localStorage.getItem = () => { throw new Error('Storage error') }

            const result = getSortOrder()
            expect(result).toBe('custom')

            // Restore original method
            localStorage.getItem = originalGetItem
        })
    })

    describe('setSortOrder', () => {
        it('stores "newest-first" in localStorage', () => {
            setSortOrder('newest-first')
            expect(localStorage.getItem('kanban-board-sort-order')).toBe('newest-first')
        })

        it('stores "oldest-first" in localStorage', () => {
            setSortOrder('oldest-first')
            expect(localStorage.getItem('kanban-board-sort-order')).toBe('oldest-first')
        })

        it('stores "custom" in localStorage', () => {
            setSortOrder('custom')
            expect(localStorage.getItem('kanban-board-sort-order')).toBe('custom')
        })

        it('does not throw when localStorage throws an error', () => {
            // Mock localStorage.setItem to throw an error
            const originalSetItem = localStorage.setItem
            localStorage.setItem = () => { throw new Error('Storage error') }

            expect(() => setSortOrder('newest-first')).not.toThrow()

            // Restore original method
            localStorage.setItem = originalSetItem
        })
    })

    describe('integration', () => {
        it('persists and retrieves sort order correctly', () => {
            const orders: CardSortOrder[] = ['newest-first', 'oldest-first', 'custom']

            for (const order of orders) {
                setSortOrder(order)
                const retrieved = getSortOrder()
                expect(retrieved).toBe(order)
            }
        })
    })
})
