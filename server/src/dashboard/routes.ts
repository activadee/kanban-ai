import {Hono} from 'hono'
import type {DashboardTimeRange, DashboardTimeRangePreset} from 'shared'
import type {AppEnv} from '../env'
import {
    getDashboardOverview,
    markDashboardInboxItemsRead,
    setDashboardInboxItemRead,
} from 'core'
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
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const presetParam = searchParams.get('timeRangePreset')
    const rangeAlias = searchParams.get('range')

    const allowedPresets = new Set<DashboardTimeRangePreset>([
        'last_24h',
        'last_7d',
        'last_30d',
        'last_90d',
        'all_time',
    ])
    const rangeAliasToPreset: Record<string, DashboardTimeRangePreset> = {
        '24h': 'last_24h',
        '7d': 'last_7d',
        '30d': 'last_30d',
        '90d': 'last_90d',
        all: 'all_time',
    }

    if (from || to) {
        // If either is specified, require both and validate them as ISO 8601.
        if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to)) {
            return {invalid: true}
        }
        return {timeRange: {from, to}}
    }

    if (presetParam && allowedPresets.has(presetParam as any)) {
        return {timeRange: {preset: presetParam as any}}
    }

    if (rangeAlias) {
        const mapped = rangeAliasToPreset[rangeAlias]
        if (!mapped) {
            return {invalid: true}
        }
        return {timeRange: {preset: mapped}}
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
                detail:
                    'Invalid time range; use ISO 8601 from/to, a supported timeRangePreset, or a supported range alias',
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

    router.patch('/inbox/:id/read', async (c) => {
        const id = c.req.param('id')
        if (!id) {
            return problemJson(c, {status: 400, detail: 'Missing inbox item id'})
        }
        let body: any = {}
        try {
            body = await c.req.json()
        } catch {
            body = {}
        }
        const isRead =
            typeof body?.isRead === 'boolean'
                ? body.isRead
                : typeof body?.is_read === 'boolean'
                    ? body.is_read
                    : true
        await setDashboardInboxItemRead(id, isRead)
        return c.json({ok: true, id, isRead})
    })

    router.patch('/inbox/mark-all-read', async (c) => {
        const url = new URL(c.req.url)
        const {timeRange, invalid} = parseTimeRangeFromQuery(url.searchParams)
        if (invalid) {
            return problemJson(c, {
                status: 400,
                detail:
                    'Invalid time range; use ISO 8601 from/to, a supported timeRangePreset, or a supported range alias',
            })
        }
        const overview = await getDashboardOverview(timeRange)
        const inbox = overview.inboxItems
        const ids: string[] = []
        ids.push(...(inbox.review ?? []).map((i) => i.id))
        ids.push(...(inbox.failed ?? []).map((i) => i.id))
        ids.push(...(inbox.stuck ?? []).map((i) => i.id))
        await markDashboardInboxItemsRead(ids)
        return c.json({ok: true, count: ids.length})
    })

    return router
}
