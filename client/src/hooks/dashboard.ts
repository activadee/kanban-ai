import {useEffect, useMemo} from 'react'
import {useQuery, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
import type {DashboardOverview, WsMsg} from 'shared'
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

export function useDashboardOverview(options?: Options) {
    return useQuery({
        queryKey: dashboardKeys.overview(),
        queryFn: getDashboardOverview,
        refetchInterval: 15_000,
        refetchIntervalInBackground: true,
        ...options,
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
