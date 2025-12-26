const STORAGE_KEY = 'kanban-board-sort-order'

export type CardSortOrder = 'newest-first' | 'oldest-first' | 'custom'

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
