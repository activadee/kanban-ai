import {useEffect, useMemo} from 'react'
import {useQuery, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
import type {DashboardOverview, DashboardTimeRangePreset, DashboardTimeRangeQuery, WsMsg} from 'shared'
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
     * When omitted, the backend falls back to its default range (currently
     * last 7 days). The hook keeps the default preset on the legacy cache
     * key so that WebSocket updates wired via `useDashboardStream` continue
     * to work without changes.
     */
    timeRangePreset?: DashboardTimeRangePreset
}

export function useDashboardOverview(options?: DashboardOverviewOptions) {
    const {timeRangePreset, ...queryOptions} = options ?? {}

    const queryKey =
        !timeRangePreset || timeRangePreset === 'last_7d'
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
