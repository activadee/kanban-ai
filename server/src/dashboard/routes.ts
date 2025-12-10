import {Hono} from 'hono'
import type {DashboardTimeRange} from 'shared'
import type {AppEnv} from '../env'
import {getDashboardOverview} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'

type TimeRangeParseResult = {
    timeRange?: DashboardTimeRange
    invalid?: boolean
}

function isValidIsoDate(value: string | null): boolean {
    if (!value) return false
    const time = Date.parse(value)
    return Number.isFinite(time)
}

function parseTimeRangeFromQuery(searchParams: URLSearchParams): TimeRangeParseResult {
    const presetParam = searchParams.get('timeRangePreset')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const allowedPresets = new Set(['last_24h', 'last_7d', 'last_30d', 'last_90d', 'all_time'] as const)

    if (presetParam && allowedPresets.has(presetParam as any)) {
        return {timeRange: {preset: presetParam as any}}
    }

    if (from || to) {
        // If either is specified, require both and validate them as ISO 8601.
        if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to)) {
            return {invalid: true}
        }
        return {timeRange: {from, to}}
    }

    return {}
}

export function createDashboardRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', async (c) => {
        const url = new URL(c.req.url)
        const {timeRange, invalid} = parseTimeRangeFromQuery(url.searchParams)

        if (invalid) {
            return problemJson(c, {
                status: 400,
                detail: 'Invalid time range; use ISO 8601 from/to or a supported timeRangePreset',
            })
        }
        const startedAt = Date.now()
        const overview = await getDashboardOverview(timeRange)
        const elapsedMs = Date.now() - startedAt
        log.debug('dashboard', 'overview computed', {
            elapsedMs,
            preset: timeRange?.preset,
            hasCustomRange: Boolean(timeRange?.from || timeRange?.to),
        })
        return c.json(overview)
    })

    return router
}
