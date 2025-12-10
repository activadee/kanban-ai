import {DEFAULT_DASHBOARD_TIME_RANGE_PRESET, type DashboardTimeRange, type DashboardTimeRangePreset} from 'shared'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isValidIsoDate(value: string | null | undefined): boolean {
    if (!value) return false
    const time = Date.parse(value)
    return Number.isFinite(time)
}

function resolveWindowMsForPreset(preset: Exclude<DashboardTimeRangePreset, 'all_time'>): number {
    switch (preset) {
        case 'last_7d':
            return 7 * ONE_DAY_MS
        case 'last_30d':
            return 30 * ONE_DAY_MS
        case 'last_90d':
            return 90 * ONE_DAY_MS
        case 'last_24h':
        default:
            return ONE_DAY_MS
    }
}

export function resolveTimeRange(input?: DashboardTimeRange, now: Date = new Date()): DashboardTimeRange {
    // Custom bounds always win when valid.
    if (input?.from || input?.to) {
        const {from, to} = input
        const hasBoth = Boolean(from && to)
        const bothValid = hasBoth && isValidIsoDate(from as string) && isValidIsoDate(to as string)

        if (bothValid) {
            return {
                preset: input.preset,
                from: from as string,
                to: to as string,
            }
        }
        // If custom bounds are incomplete or invalid, ignore them and fall back
        // to a preset-based window rather than propagating bad dates.
    }

    const preset = input?.preset ?? DEFAULT_DASHBOARD_TIME_RANGE_PRESET

    // Special-case "all_time" as unbounded on the lower side.
    if (preset === 'all_time') {
        return {
            preset,
            to: now.toISOString(),
        }
    }

    const windowMs = resolveWindowMsForPreset(preset)
    const to = now.toISOString()
    const from = new Date(now.getTime() - windowMs).toISOString()

    return {
        preset,
        from,
        to,
    }
}

export type ResolvedTimeBounds = {
    from: Date | null
    to: Date | null
}

export function resolveTimeBounds(range: DashboardTimeRange, now: Date = new Date()): ResolvedTimeBounds {
    const normalized = resolveTimeRange(range, now)

    const from = normalized.from ? new Date(normalized.from) : null
    const to = normalized.to ? new Date(normalized.to) : null

    if (Number.isNaN(from?.getTime() ?? 0)) {
        return {from: null, to}
    }
    if (Number.isNaN(to?.getTime() ?? 0)) {
        return {from, to: null}
    }

    return {from, to}
}
