import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import type {DashboardOverview, DashboardTimeRange} from 'shared'
import {createDashboardRouter} from '../src/dashboard/routes'

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
    }
})

const createApp = () => {
    const app = new Hono()
    app.route('/dashboard', createDashboardRouter())
    return app
}

describe('GET /dashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('delegates to core with no explicit time range by default', async () => {
        const app = createApp()
        const res = await app.request('/dashboard')

        expect(res.status).toBe(200)

        const {getDashboardOverview} = await import('core')
        expect(getDashboardOverview).toHaveBeenCalledTimes(1)
        expect(getDashboardOverview).toHaveBeenCalledWith(undefined)
    })

    it('passes a preset time range when timeRangePreset is provided', async () => {
        const app = createApp()
        const res = await app.request('/dashboard?timeRangePreset=last_7d')

        expect(res.status).toBe(200)

        const {getDashboardOverview} = await import('core')
        expect(getDashboardOverview).toHaveBeenCalledTimes(1)
        expect(getDashboardOverview).toHaveBeenCalledWith({preset: 'last_7d'})
    })

    it('accepts the all_time preset', async () => {
        const app = createApp()
        const res = await app.request('/dashboard?timeRangePreset=all_time')

        expect(res.status).toBe(200)

        const {getDashboardOverview} = await import('core')
        expect(getDashboardOverview).toHaveBeenCalledTimes(1)
        expect(getDashboardOverview).toHaveBeenCalledWith({preset: 'all_time'})
    })

    it('passes a custom from/to time range when both are provided', async () => {
        const app = createApp()
        const from = '2025-01-01T00:00:00Z'
        const to = '2025-01-02T00:00:00Z'

        const res = await app.request(`/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

        expect(res.status).toBe(200)

        const {getDashboardOverview} = await import('core')
        expect(getDashboardOverview).toHaveBeenCalledTimes(1)
        expect(getDashboardOverview).toHaveBeenCalledWith({from, to})
    })

    it('returns 400 when from/to are invalid or incomplete', async () => {
        const app = createApp()

        // Invalid date strings
        const resInvalid = await app.request('/dashboard?from=not-a-date&to=also-bad')
        expect(resInvalid.status).toBe(400)
        const bodyInvalid = (await resInvalid.json()) as any
        expect(bodyInvalid.status).toBe(400)

        // Missing `to`
        const resMissingTo = await app.request('/dashboard?from=2025-01-01T00:00:00Z')
        expect(resMissingTo.status).toBe(400)

        // Missing `from`
        const resMissingFrom = await app.request('/dashboard?to=2025-01-02T00:00:00Z')
        expect(resMissingFrom.status).toBe(400)
    })
})
