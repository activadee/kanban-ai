import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSortOrder, setSortOrder, sortCardsByDate, type CardSortOrder } from '@/lib/sortOrder'
import type { Card } from 'shared'

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

    describe('sortCardsByDate', () => {
        const mockCard = (id: string, createdAt: string): Card => ({
            id,
            title: `Card ${id}`,
            isEnhanced: false,
            createdAt,
            updatedAt: createdAt
        })

        it('sorts cards by newest first (descending)', () => {
            const cards = [
                mockCard('1', '2025-01-01T10:00:00Z'),
                mockCard('2', '2025-01-03T10:00:00Z'),
                mockCard('3', '2025-01-02T10:00:00Z')
            ]

            const result = sortCardsByDate(cards, 'newest-first')

            expect(result[0].id).toBe('2')
            expect(result[1].id).toBe('3')
            expect(result[2].id).toBe('1')
        })

        it('sorts cards by oldest first (ascending)', () => {
            const cards = [
                mockCard('1', '2025-01-01T10:00:00Z'),
                mockCard('2', '2025-01-03T10:00:00Z'),
                mockCard('3', '2025-01-02T10:00:00Z')
            ]

            const result = sortCardsByDate(cards, 'oldest-first')

            expect(result[0].id).toBe('1')
            expect(result[1].id).toBe('3')
            expect(result[2].id).toBe('2')
        })

        it('handles cards with the same creation date', () => {
            const cards = [
                mockCard('1', '2025-01-01T10:00:00Z'),
                mockCard('2', '2025-01-01T10:00:00Z'),
                mockCard('3', '2025-01-01T10:00:00Z')
            ]

            const resultNewest = sortCardsByDate(cards, 'newest-first')
            const resultOldest = sortCardsByDate(cards, 'oldest-first')

            expect(resultNewest).toHaveLength(3)
            expect(resultOldest).toHaveLength(3)
        })

        it('preserves original order when sortOrder is custom', () => {
            const cards = [
                mockCard('1', '2025-01-03T10:00:00Z'),
                mockCard('2', '2025-01-01T10:00:00Z'),
                mockCard('3', '2025-01-02T10:00:00Z')
            ]

            const result = sortCardsByDate(cards, 'custom')

            expect(result[0].id).toBe('1')
            expect(result[1].id).toBe('2')
            expect(result[2].id).toBe('3')
        })

        it('handles empty array', () => {
            const result = sortCardsByDate([], 'newest-first')
            expect(result).toHaveLength(0)
        })

        it('handles single card', () => {
            const cards = [mockCard('1', '2025-01-01T10:00:00Z')]
            const result = sortCardsByDate(cards, 'newest-first')
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('1')
        })

        it('handles ISO date strings with different timezones', () => {
            const cards = [
                mockCard('1', '2025-01-01T10:00:00+00:00'),
                mockCard('2', '2025-01-01T05:00:00-05:00'),
                mockCard('3', '2025-01-01T15:00:00+05:00')
            ]

            const result = sortCardsByDate(cards, 'newest-first')

            expect(result).toHaveLength(3)
        })
    })
})
