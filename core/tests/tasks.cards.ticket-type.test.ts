import {beforeEach, describe, expect, it, vi} from 'vitest'

const insertCard = vi.fn()
const updateCard = vi.fn()
const getColumnById = vi.fn()
const getCardById = vi.fn()
const getMaxCardOrder = vi.fn()

vi.mock('../src/projects/repo', () => ({
    listColumnsForBoard: vi.fn(),
    getColumnById,
    listCardsForColumns: vi.fn(),
    getCardById,
    insertCard,
    updateCard,
    deleteCard: vi.fn(),
    getMaxCardOrder,
}))

const reserveNextTicketKey = vi.fn()
vi.mock('../src/projects/tickets/service', () => ({
    reserveNextTicketKey,
    isUniqueTicketKeyError: () => false,
}))

const broadcastBoard = vi.fn()
vi.mock('../src/tasks/board.service', () => ({
    broadcastBoard,
    ensureDefaultColumns: vi.fn(),
}))

vi.mock('../src/db/with-tx', () => ({
    withTx: async (fn: any) => fn({}),
    resolveDb: () => ({}),
}))

describe('tasks/cards ticket types', () => {
    beforeEach(() => {
        insertCard.mockReset()
        updateCard.mockReset()
        getColumnById.mockReset()
        getCardById.mockReset()
        getMaxCardOrder.mockReset()
        reserveNextTicketKey.mockReset()
        broadcastBoard.mockReset()
    })

    it('stores ticketType on create', async () => {
        const {createBoardCard} = await import('../src/tasks/cards.service')
        getColumnById.mockResolvedValue({id: 'col-1', boardId: 'board-1'})
        getMaxCardOrder.mockResolvedValue(-1)
        reserveNextTicketKey.mockResolvedValue({key: 'PRJ-1'})

        await createBoardCard('col-1', 'New card', 'desc', 'feat', {suppressBroadcast: true})

        expect(insertCard).toHaveBeenCalledWith(
            expect.objectContaining({ticketType: 'feat'}),
            expect.anything(),
        )
    })

    it('updates ticketType and broadcasts board state', async () => {
        const {updateBoardCard} = await import('../src/tasks/cards.service')
        getCardById.mockResolvedValue({
            id: 'card-1',
            boardId: 'board-1',
            columnId: 'col-1',
            title: 'Old',
            description: null,
        })

        await updateBoardCard('card-1', {ticketType: 'fix'})

        expect(updateCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({ticketType: 'fix'}),
        )
        expect(broadcastBoard).toHaveBeenCalledWith('board-1')
    })

    it('sets isEnhanced when provided', async () => {
        const {updateBoardCard} = await import('../src/tasks/cards.service')
        getCardById.mockResolvedValue({
            id: 'card-1',
            boardId: 'board-1',
            columnId: 'col-1',
            title: 'Old',
            description: null,
        })

        await updateBoardCard('card-1', {isEnhanced: true})

        expect(updateCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({isEnhanced: true}),
        )
    })

    it('sets disableAutoCloseOnPRMerge when provided', async () => {
        const {updateBoardCard} = await import('../src/tasks/cards.service')
        getCardById.mockResolvedValue({
            id: 'card-1',
            boardId: 'board-1',
            columnId: 'col-1',
            title: 'Old',
            description: null,
        })

        await updateBoardCard('card-1', {disableAutoCloseOnPRMerge: true})

        expect(updateCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({disableAutoCloseOnPRMerge: true}),
        )
    })

    it('ignores non-boolean disableAutoCloseOnPRMerge', async () => {
        const {updateBoardCard} = await import('../src/tasks/cards.service')
        getCardById.mockResolvedValue({
            id: 'card-1',
            boardId: 'board-1',
            columnId: 'col-1',
            title: 'Old',
            description: null,
        })

        await updateBoardCard('card-1', {
            disableAutoCloseOnPRMerge: ('false' as unknown) as boolean,
        })

        expect(updateCard).not.toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({
                disableAutoCloseOnPRMerge: expect.anything(),
            }),
        )
    })
})
