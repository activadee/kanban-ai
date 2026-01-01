import {useEffect, useMemo, useRef, useState} from 'react'
import {useQuery, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
import {
    DEFAULT_DASHBOARD_TIME_RANGE_PRESET,
    DASHBOARD_METRIC_KEYS,
    type DashboardOverview,
    type DashboardTimeRangePreset,
    type DashboardTimeRangeQuery,
} from 'shared'
import {getDashboardOverview} from '@/api/dashboard'
import {dashboardKeys} from '@/lib/queryClient'
import {resolveApiBase} from '@/lib/env'

type Options = Partial<UseQueryOptions<DashboardOverview>>

type DashboardOverviewOptions = Options & {
    /**
     * Optional preset controlling the dashboard time window.
     *
     * When omitted, the backend falls back to its default range. The hook
     * keeps the default preset on the legacy cache key so that SSE
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

export type DashboardStreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error'

const RECONNECT_BASE_DELAY_MS = 1_500
const RECONNECT_MAX_DELAY_MS = 12_000

function resolveDashboardSseUrl() {
    const explicit = import.meta.env.VITE_SSE_URL as string | undefined
    if (explicit) return explicit.replace(/\/?$/, '')
    const apiBase = resolveApiBase()
    return apiBase + '/sse'
}

export function useDashboardStream(enabled = true): {
    status: DashboardStreamStatus
} {
    const queryClient = useQueryClient()
    const url = useMemo(() => resolveDashboardSseUrl(), [])

    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimerRef = useRef<number | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const shouldReconnectRef = useRef(false)

    const [status, setStatus] = useState<DashboardStreamStatus>('idle')

    useEffect(() => {
        let disposed = false

        const clearReconnectTimer = () => {
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
        }

        const scheduleReconnect = () => {
            if (!shouldReconnectRef.current || disposed) return
            if (reconnectTimerRef.current !== null) return

            const attempt = reconnectAttemptsRef.current
            const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS)

            reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null
                if (!shouldReconnectRef.current || disposed) return
                reconnectAttemptsRef.current = Math.min(attempt + 1, 8)
                connect()
            }, delay)
        }

        function connect() {
            if (!enabled || disposed || !shouldReconnectRef.current) {
                return
            }

            clearReconnectTimer()
            setStatus((current) => (current === 'idle' ? 'connecting' : 'reconnecting'))

            const eventSource = new EventSource(url)
            eventSourceRef.current = eventSource

            eventSource.onopen = () => {
                if (disposed || eventSourceRef.current !== eventSource) return
                reconnectAttemptsRef.current = 0
                setStatus('open')
            }

            eventSource.onerror = () => {
                if (disposed) return
                eventSource.close()
                eventSourceRef.current = null
                setStatus((current) => (current === 'open' ? 'reconnecting' : 'error'))
                scheduleReconnect()
            }

            eventSource.addEventListener('dashboard_overview', (event) => {
                if (disposed) return
                try {
                    const data = JSON.parse((event as MessageEvent).data)
                    queryClient.setQueryData(dashboardKeys.overview(), data)
                } catch (error) {
                    console.warn('[dashboard] ignored malformed SSE payload', error)
                }
            })
        }

        shouldReconnectRef.current = enabled

        if (enabled) {
            connect()
        } else {
            setStatus('idle')
        }

        return () => {
            disposed = true
            shouldReconnectRef.current = false
            clearReconnectTimer()
            if (eventSourceRef.current) {
                try {
                    eventSourceRef.current.close()
                } catch {
                }
                eventSourceRef.current = null
            }
        }
    }, [enabled, queryClient, url])

    return {status}
}
