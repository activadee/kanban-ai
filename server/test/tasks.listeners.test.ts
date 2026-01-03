import {describe, expect, it, vi, beforeEach} from 'vitest'
import {createEventBus} from '../src/events/bus'
import {registerTaskListeners} from '../src/tasks/listeners'

vi.mock('../src/tasks/service', () => ({
    bindTaskEventBus: vi.fn(),
    moveCardToColumnByTitle: vi.fn(),
    createDefaultBoardStructure: vi.fn(),
}))

describe('registerTaskListeners', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not subscribe to attempt.completed event', () => {
        const bus = createEventBus()
        registerTaskListeners(bus)

        expect(bus.listenerCount('attempt.completed')).toBe(0)
    })

    it('still subscribes to attempt.started event', () => {
        const bus = createEventBus()
        registerTaskListeners(bus)

        expect(bus.listenerCount('attempt.started')).toBe(1)
    })

    it('still subscribes to project.created event', () => {
        const bus = createEventBus()
        registerTaskListeners(bus)

        expect(bus.listenerCount('project.created')).toBe(1)
    })

    it('attempt.completed event does not trigger card movement', async () => {
        const {moveCardToColumnByTitle} = await import('../src/tasks/service')
        const bus = createEventBus()
        registerTaskListeners(bus)

        bus.publish('attempt.completed', {
            attemptId: 'attempt-1',
            boardId: 'board-1',
            cardId: 'card-1',
            status: 'succeeded',
            worktreePath: '/tmp/worktree',
        })

        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(moveCardToColumnByTitle).not.toHaveBeenCalled()
    })
})
