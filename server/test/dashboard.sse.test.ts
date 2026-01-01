import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {DashboardOverview, DashboardTimeRange} from 'shared'
import {registerDashboardListeners} from '../src/dashboard/listeners'
import {createEventBus} from '../src/events/bus'
import {addConnection, closeAllConnections, type SSEConnection} from '../src/sse/bus'

const createFakeOverview = (): DashboardOverview => ({
    timeRange: {preset: 'last_24h'},
    generatedAt: new Date().toISOString(),
    metrics: {
        byKey: {},
    },
    activeAttempts: [],
    recentAttemptActivity: [],
    inboxItems: {
        review: [],
        failed: [],
        stuck: [],
    },
    projectSnapshots: [],
    agentStats: [],
})

vi.mock('core', () => {
    const getDashboardOverview = vi.fn(
        async (_timeRange?: DashboardTimeRange): Promise<DashboardOverview> => createFakeOverview(),
    )

    return {
        getDashboardOverview,
        bindAgentEventBus: vi.fn(),
        registerAgent: vi.fn(),
        getAgent: vi.fn(),
        listAgents: vi.fn(() => []),
        CodexAgent: {},
        OpencodeAgent: {},
        DroidAgent: {},
    }
})

function createMockConnection(): SSEConnection {
    return {
        stream: {
            writeSSE: vi.fn(),
        } as any,
        aborted: false,
    }
}

describe('dashboard SSE listeners', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        closeAllConnections()
        vi.useRealTimers()
    })

    it('broadcasts dashboard_overview when project.created fires', async () => {
        const bus = createEventBus()
        const conn = createMockConnection()
        addConnection('dashboard', conn)
        registerDashboardListeners(bus)

        bus.publish('project.created', {projectId: 'p1'} as any)

        await vi.runAllTimersAsync()

        expect(conn.stream.writeSSE).toHaveBeenCalled()
        const call = (conn.stream.writeSSE as any).mock.calls[0][0]
        expect(call.event).toBe('dashboard_overview')
        const payload = JSON.parse(call.data)
        expect(payload.timeRange).toBeTruthy()
    })

    it('broadcasts dashboard_overview when card.created fires', async () => {
        const bus = createEventBus()
        const conn = createMockConnection()
        addConnection('dashboard', conn)
        registerDashboardListeners(bus)

        bus.publish('card.created', {boardId: 'b1', cardId: 'c1'} as any)

        await vi.runAllTimersAsync()

        expect(conn.stream.writeSSE).toHaveBeenCalled()
        const call = (conn.stream.writeSSE as any).mock.calls[0][0]
        expect(call.event).toBe('dashboard_overview')
    })

    it('broadcasts dashboard_overview when attempt.started fires', async () => {
        const bus = createEventBus()
        const conn = createMockConnection()
        addConnection('dashboard', conn)
        registerDashboardListeners(bus)

        bus.publish('attempt.started', {boardId: 'b1', attemptId: 'a1', cardId: 'c1'} as any)

        await vi.runAllTimersAsync()

        expect(conn.stream.writeSSE).toHaveBeenCalled()
        const call = (conn.stream.writeSSE as any).mock.calls[0][0]
        expect(call.event).toBe('dashboard_overview')
    })

    it('debounces rapid events into single broadcast', async () => {
        const bus = createEventBus()
        const conn = createMockConnection()
        addConnection('dashboard', conn)
        registerDashboardListeners(bus)

        // Fire multiple events rapidly
        bus.publish('card.created', {boardId: 'b1', cardId: 'c1'} as any)
        bus.publish('card.updated', {boardId: 'b1', cardId: 'c1'} as any)
        bus.publish('card.moved', {boardId: 'b1', cardId: 'c1'} as any)

        await vi.runAllTimersAsync()

        // Should only broadcast once due to debouncing
        expect(conn.stream.writeSSE).toHaveBeenCalledTimes(1)
    })

    it('does not broadcast to non-dashboard channels', async () => {
        const bus = createEventBus()
        const dashboardConn = createMockConnection()
        const boardConn = createMockConnection()
        addConnection('dashboard', dashboardConn)
        addConnection('board-1', boardConn)
        registerDashboardListeners(bus)

        bus.publish('project.created', {projectId: 'p1'} as any)

        await vi.runAllTimersAsync()

        expect(dashboardConn.stream.writeSSE).toHaveBeenCalled()
        expect(boardConn.stream.writeSSE).not.toHaveBeenCalled()
    })
})
