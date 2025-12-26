import { describe, it, expect } from 'vitest'
import type { Card } from 'shared'
import { sortCardsByDate } from '@/lib/sortOrder'

describe('Card sorting logic', () => {
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

    it('preserves original array order when sorting by creation date is disabled (custom)', () => {
        const cards = [
            mockCard('1', '2025-01-03T10:00:00Z'),
            mockCard('2', '2025-01-01T10:00:00Z'),
            mockCard('3', '2025-01-02T10:00:00Z')
        ]

        const customOrder = sortCardsByDate(cards, 'custom')
        expect(customOrder[0].id).toBe('1')
        expect(customOrder[1].id).toBe('2')
        expect(customOrder[2].id).toBe('3')
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
