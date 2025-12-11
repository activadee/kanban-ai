import {useEffect, useMemo} from 'react'
import {useQuery, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
import {
    DEFAULT_DASHBOARD_TIME_RANGE_PRESET,
    DASHBOARD_METRIC_KEYS,
    type DashboardOverview,
    type DashboardTimeRangePreset,
    type DashboardTimeRangeQuery,
    type WsMsg,
} from 'shared'
import {getDashboardOverview} from '@/api/dashboard'
import {dashboardKeys} from '@/lib/queryClient'
import {resolveApiBase} from '@/lib/env'

function resolveDashboardWsUrl() {
    const explicit = import.meta.env.VITE_WS_URL as string | undefined
    if (explicit) return `${explicit.replace(/\/?$/, '')}/dashboard`

    // Keep websocket origin/port in lockstep with the REST API base.
    const apiBase = resolveApiBase()
    return apiBase.replace(/^http/i, 'ws') + '/ws/dashboard'
}

type Options = Partial<UseQueryOptions<DashboardOverview>>

type DashboardOverviewOptions = Options & {
    /**
     * Optional preset controlling the dashboard time window.
     *
     * When omitted, the backend falls back to its default range. The hook
     * keeps the default preset on the legacy cache key so that WebSocket
     * updates wired via `useDashboardStream` continue to work without
     * changes.
     */
    timeRangePreset?: DashboardTimeRangePreset
}

export function useDashboardOverview(options?: DashboardOverviewOptions) {
    const {timeRangePreset, ...queryOptions} = options ?? {}

    const queryKey =
        !timeRangePreset || timeRangePreset === DEFAULT_DASHBOARD_TIME_RANGE_PRESET
            ? dashboardKeys.overview()
            : dashboardKeys.overview(timeRangePreset)

    const timeRangeParams: DashboardTimeRangeQuery | undefined = timeRangePreset
        ? {timeRangePreset}
        : undefined

    return useQuery({
        queryKey,
        queryFn: () => getDashboardOverview(timeRangeParams),
        refetchInterval: 15_000,
        refetchIntervalInBackground: true,
        ...queryOptions,
    })
}

export interface DashboardKpiMetrics {
    /**
     * Number of currently active attempts in the dashboard snapshot.
     */
    activeAttempts: number
    /**
     * Number of attempts whose `createdAt` falls within the selected time range.
     */
    attemptsInRange: number
    /**
     * Success rate for attempts within the selected time range, expressed as a
     * fraction between `0` and `1`.
     */
    successRateInRange: number
    /**
     * Number of inbox items that require review.
     */
    reviewItemsCount: number
    /**
     * Number of projects/boards with any attempt activity in range.
     */
    projectsWithActivity: number
}

export function deriveDashboardKpiMetrics(overview: DashboardOverview): DashboardKpiMetrics {
    const {metrics, inboxItems, activeAttempts, attemptsInRange, successRateInRange, projectsWithActivityInRange} =
        overview

    const activeAttemptsFromMetrics =
        metrics.activeAttempts ?? metrics.byKey[DASHBOARD_METRIC_KEYS.activeAttempts]?.total
    const activeAttemptsCount = activeAttemptsFromMetrics ?? activeAttempts.length

    const attemptsInRangeValue = metrics.attemptsInRange ?? attemptsInRange ?? 0

    const successRateInRangeValue = metrics.successRateInRange ?? successRateInRange ?? 0

    const inboxMeta = inboxItems.meta as {totalReview?: unknown} | undefined
    const reviewItemsCountFromMeta =
        typeof inboxMeta?.totalReview === 'number' ? inboxMeta.totalReview : undefined
    const reviewItemsCount =
        metrics.reviewItemsCount ?? reviewItemsCountFromMeta ?? inboxItems.review.length

    const projectsWithActivityValue =
        metrics.projectsWithActivity ?? projectsWithActivityInRange ?? 0

    return {
        activeAttempts: activeAttemptsCount,
        attemptsInRange: attemptsInRangeValue,
        successRateInRange: successRateInRangeValue,
        reviewItemsCount,
        projectsWithActivity: projectsWithActivityValue,
    }
}

export function useDashboardMetrics(options?: DashboardOverviewOptions): {
    data?: DashboardKpiMetrics
    isLoading: boolean
    isError: boolean
    error: unknown
} {
    const overviewQuery = useDashboardOverview(options)

    const data = useMemo<DashboardKpiMetrics | undefined>(() => {
        const overview = overviewQuery.data
        if (!overview) return undefined

        return deriveDashboardKpiMetrics(overview)
    }, [overviewQuery.data])

    return {
        data,
        isLoading: overviewQuery.isLoading,
        isError: overviewQuery.isError ?? false,
        error: overviewQuery.error,
    }
}

export function useDashboardStream(enabled = true) {
    const queryClient = useQueryClient()
    const url = useMemo(() => resolveDashboardWsUrl(), [])

    useEffect(() => {
        if (!enabled) return
        const ws = new WebSocket(url)

        ws.addEventListener('message', (event) => {
            try {
                const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)
                const msg = JSON.parse(raw) as WsMsg
                if (msg.type === 'dashboard_overview') {
                    queryClient.setQueryData(dashboardKeys.overview(), msg.payload)
                }
            } catch (error) {
                console.warn('[dashboard] ignored malformed websocket payload', error)
            }
        })

        return () => {
            ws.close()
        }
    }, [enabled, queryClient, url])
}
