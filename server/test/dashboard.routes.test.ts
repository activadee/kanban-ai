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
    const setDashboardInboxItemRead = vi.fn(async (_id: string, _isRead: boolean) => {})
    const markDashboardInboxItemsRead = vi.fn(async (_ids: string[]) => {})

    return {
        getDashboardOverview,
        setDashboardInboxItemRead,
        markDashboardInboxItemsRead,
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

    it('accepts the range alias and maps to presets', async () => {
        const app = createApp()

        const cases: Array<{alias: string; preset: string}> = [
            {alias: '24h', preset: 'last_24h'},
            {alias: '7d', preset: 'last_7d'},
            {alias: '30d', preset: 'last_30d'},
            {alias: '90d', preset: 'last_90d'},
            {alias: 'all', preset: 'all_time'},
        ]

        for (const {alias, preset} of cases) {
            const res = await app.request(`/dashboard?range=${alias}`)
            expect(res.status).toBe(200)
            const {getDashboardOverview} = await import('core')
            expect(getDashboardOverview).toHaveBeenCalledWith({preset})
            vi.clearAllMocks()
        }
    })

    it('gives precedence to from/to over timeRangePreset and range', async () => {
        const app = createApp()
        const from = '2025-01-01T00:00:00Z'
        const to = '2025-01-02T00:00:00Z'

        const res = await app.request(
            `/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
                to,
            )}&timeRangePreset=last_7d&range=24h`,
        )

        expect(res.status).toBe(200)

        const {getDashboardOverview} = await import('core')
        expect(getDashboardOverview).toHaveBeenCalledTimes(1)
        expect(getDashboardOverview).toHaveBeenCalledWith({from, to})
    })

    it('gives precedence to timeRangePreset over range when both are valid', async () => {
        const app = createApp()
        const res = await app.request('/dashboard?timeRangePreset=last_7d&range=24h')

        expect(res.status).toBe(200)

        const {getDashboardOverview} = await import('core')
        expect(getDashboardOverview).toHaveBeenCalledTimes(1)
        expect(getDashboardOverview).toHaveBeenCalledWith({preset: 'last_7d'})
    })

    it('returns 400 when range alias is unknown', async () => {
        const app = createApp()
        const res = await app.request('/dashboard?range=2weeks')

        expect(res.status).toBe(400)
        const body = (await res.json()) as any
        expect(body.status).toBe(400)
    })
})

describe('PATCH /dashboard/inbox/:id/read', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('marks an individual inbox item read/unread', async () => {
        const app = createApp()
        const res = await app.request('/dashboard/inbox/attempt-123/read', {
            method: 'PATCH',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({isRead: true}),
        })

        expect(res.status).toBe(200)
        const {setDashboardInboxItemRead} = await import('core')
        expect(setDashboardInboxItemRead).toHaveBeenCalledTimes(1)
        expect(setDashboardInboxItemRead).toHaveBeenCalledWith('attempt-123', true)
    })

    it('defaults to marking read when body is missing', async () => {
        const app = createApp()
        const res = await app.request('/dashboard/inbox/attempt-456/read', {
            method: 'PATCH',
        })

        expect(res.status).toBe(200)
        const {setDashboardInboxItemRead} = await import('core')
        expect(setDashboardInboxItemRead).toHaveBeenCalledWith('attempt-456', true)
    })
})

describe('PATCH /dashboard/inbox/mark-all-read', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('marks all current inbox items read', async () => {
        const app = createApp()
        const fakeOverview = createFakeOverview()
        fakeOverview.inboxItems.review = [
            {id: 'r1', type: 'review', createdAt: new Date().toISOString()},
        ] as any
        fakeOverview.inboxItems.failed = [
            {id: 'f1', type: 'failed', createdAt: new Date().toISOString(), errorSummary: 'x'},
        ] as any
        const {getDashboardOverview} = await import('core')
        ;(getDashboardOverview as any).mockResolvedValueOnce(fakeOverview)

        const res = await app.request('/dashboard/inbox/mark-all-read', {method: 'PATCH'})

        expect(res.status).toBe(200)
        const {markDashboardInboxItemsRead} = await import('core')
        expect(markDashboardInboxItemsRead).toHaveBeenCalledTimes(1)
        expect(markDashboardInboxItemsRead).toHaveBeenCalledWith(['r1', 'f1'])
    })
})
