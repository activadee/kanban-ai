import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {WSContext} from 'hono/ws'
import {kanbanWebsocketHandlers} from '../src/ws/kanban-handlers'

vi.mock('core', () => ({
    attemptsRepo: {
        listAttemptsForBoard: vi.fn(),
    },
    projectDeps: {
        isCardBlocked: vi.fn(),
    },
    projectsRepo: {
        getCardById: vi.fn(),
        getColumnById: vi.fn(),
    },
    tasks: {
        createBoardCard: vi.fn(),
        deleteBoardCard: vi.fn(),
        ensureBoardExists: vi.fn(),
        getBoardState: vi.fn(),
        moveBoardCard: vi.fn(),
        updateBoardCard: vi.fn(),
    },
}))

describe('kanban websocket handlers – update_card', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('forwards isEnhanced to updateBoardCard', async () => {
        const handlers = kanbanWebsocketHandlers('b1')
        const core = await import('core' as any)
        const ws = {
            send: vi.fn(),
            close: vi.fn(),
        } as unknown as WSContext

        await handlers.onMessage(
            {
                data: JSON.stringify({
                    type: 'update_card',
                    payload: {cardId: 'card-1', isEnhanced: true},
                }),
            } as any,
            ws,
        )

        expect(core.tasks.updateBoardCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({isEnhanced: true}),
        )
    })
})
