import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {WSContext} from 'hono/ws'
import type {DashboardOverview, DashboardTimeRange} from 'shared'
import {dashboardWebsocketHandlers} from '../src/ws/dashboard-handlers'
import {registerDashboardListeners} from '../src/dashboard/listeners'
import {createEventBus} from '../src/events/bus'
import {addSocket} from '../src/ws/bus'

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

describe('dashboard websocket handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('sends hello then dashboard_overview on open', async () => {
        const handlers = dashboardWebsocketHandlers()
        const sent: string[] = []
        const ws = {
            send: (msg: string) => {
                sent.push(msg)
            },
        } as unknown as WSContext

        await handlers.onOpen({} as Event, ws)

        expect(sent.length).toBe(2)

        const hello = JSON.parse(sent[0])
        expect(hello.type).toBe('hello')
        expect(typeof hello.payload?.serverTime).toBe('string')

        const overview = JSON.parse(sent[1])
        expect(overview.type).toBe('dashboard_overview')
        expect(overview.payload).toBeTruthy()
        expect(overview.payload.timeRange).toBeTruthy()
    })
})

describe('dashboard listeners', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    it('broadcasts dashboard_overview messages when project events fire', async () => {
        const bus = createEventBus()
        const sent: string[] = []
        const ws = {
            send: (msg: string) => {
                sent.push(msg)
            },
        } as unknown as WSContext

        addSocket('dashboard', ws)
        registerDashboardListeners(bus)

        bus.publish('project.created', {projectId: 'p1'} as any)

        await vi.runAllTimersAsync()

        expect(sent.length).toBeGreaterThan(0)
        const msg = JSON.parse(sent[0] as string)
        expect(msg.type).toBe('dashboard_overview')
        expect(msg.payload).toBeTruthy()
    })
})
