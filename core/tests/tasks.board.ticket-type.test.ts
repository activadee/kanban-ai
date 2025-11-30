import {describe, expect, it, vi, beforeEach} from 'vitest'

const listColumnsForBoard = vi.fn()
const listCardsForColumns = vi.fn()

vi.mock('../src/projects/repo', () => ({
    listColumnsForBoard,
    listCardsForColumns,
}))

const listDependenciesForCards = vi.fn()
vi.mock('../src/projects/dependencies', () => ({
    listDependenciesForCards,
}))

describe('tasks/board getBoardState ticket types', () => {
    beforeEach(() => {
        listColumnsForBoard.mockReset()
        listCardsForColumns.mockReset()
        listDependenciesForCards.mockReset()
    })

    it('includes ticketType on cards', async () => {
        const {getBoardState} = await import('../src/tasks/board.service')
        listColumnsForBoard.mockResolvedValue([
            {id: 'col-1', title: 'Backlog', order: 0, boardId: 'board-1'},
        ])
        listCardsForColumns.mockResolvedValue([
            {
                id: 'card-1',
                title: 'Test card',
                description: null,
                order: 0,
                columnId: 'col-1',
                boardId: 'board-1',
                ticketKey: 'PRJ-1',
                ticketType: 'feat',
                prUrl: null,
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-02T00:00:00Z'),
            },
        ])
        listDependenciesForCards.mockResolvedValue(new Map())

        const state = await getBoardState('board-1')

        expect(state.cards['card-1'].ticketType).toBe('feat')
    })
})
