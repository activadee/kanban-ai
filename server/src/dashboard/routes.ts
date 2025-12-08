import {Hono} from 'hono'
import type {DashboardTimeRange, DashboardTimeRangePreset} from 'shared'
import type {AppEnv} from '../env'
import {getDashboardOverview} from 'core'

function parseTimeRangeFromQuery(searchParams: URLSearchParams): DashboardTimeRange | undefined {
    const presetParam = searchParams.get('timeRangePreset')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let preset: DashboardTimeRangePreset | undefined

    switch (presetParam) {
        case 'last_24h':
        case 'last_7d':
        case 'last_30d':
        case 'last_90d':
            preset = presetParam
            break
        default:
            preset = undefined
    }

    if (preset) {
        return {preset}
    }

    if (from && to) {
        return {from, to}
    }

    return undefined
}

export function createDashboardRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', async (c) => {
        const url = new URL(c.req.url)
        const timeRange = parseTimeRangeFromQuery(url.searchParams)
        const overview = await getDashboardOverview(timeRange)
        return c.json(overview)
    })

    return router
}
