import type { Card } from 'shared'

const STORAGE_KEY = 'kanban-board-sort-order'

export type CardSortOrder = 'newest-first' | 'oldest-first' | 'custom'

export function sortCardsByDate(
  cards: Card[],
  sortOrder: CardSortOrder
): Card[] {
  if (sortOrder === 'custom') {
    return cards;
  }

  return [...cards]
    .map(card => ({ card, timestamp: new Date(card.createdAt).getTime() }))
    .sort((a, b) => sortOrder === 'newest-first' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp)
    .map(({ card }) => card);
}

export function getSortOrder(): CardSortOrder {
  if (typeof window === 'undefined') return 'custom'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'newest-first' || stored === 'oldest-first' || stored === 'custom') {
      return stored
    }
  } catch (error) {
    console.error('Failed to read sort order from localStorage:', error)
  }
  return 'custom'
}

export function setSortOrder(order: CardSortOrder): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, order)
  } catch (error) {
    console.error('Failed to write sort order to localStorage:', error)
  }
}
