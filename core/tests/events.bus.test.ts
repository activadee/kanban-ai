import {describe, expect, it, vi} from 'vitest'
import {createEventBus} from '../src/events/bus'

describe('events/bus', () => {
    it('publishes to subscribers and supports unsubscription', () => {
        const bus = createEventBus()
        const handler = vi.fn()
        const unsubscribe = bus.subscribe('attempt.queued' as any, handler)

        const payload = {
            attemptId: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            agent: 'agent-x',
            branchName: 'feature/test',
            baseBranch: 'main',
        }

        bus.publish('attempt.queued' as any, payload)
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith(payload)

        unsubscribe()
        bus.publish('attempt.queued' as any, payload)
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('invokes once handlers only a single time', () => {
        const bus = createEventBus()
        const handler = vi.fn()

        bus.once('attempt.started' as any, handler)

        const payload = {
            attemptId: 'att-2',
            boardId: 'board-2',
            cardId: 'card-2',
            agent: 'agent-z',
            branchName: 'feature/foo',
            baseBranch: 'develop',
            worktreePath: '/tmp/work',
        }

        bus.publish('attempt.started' as any, payload)
        bus.publish('attempt.started' as any, payload)

        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith(payload)
    })

    it('tracks listener count and can clear listeners', () => {
        const bus = createEventBus()
        const handler = vi.fn()

        bus.subscribe('git.commit.created' as any, handler)
        bus.subscribe('git.commit.created' as any, handler)

        expect(bus.listenerCount('git.commit.created' as any)).toBe(2)

        bus.removeAllListeners('git.commit.created' as any)
        expect(bus.listenerCount('git.commit.created' as any)).toBe(0)
    })
})

