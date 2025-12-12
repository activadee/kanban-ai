import type {DashboardOverview, DashboardTimeRangeQuery} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function getDashboardOverview(params?: DashboardTimeRangeQuery): Promise<DashboardOverview> {
    const searchParams = new URLSearchParams()

    if (params?.timeRangePreset) {
        searchParams.set('timeRangePreset', params.timeRangePreset)
    } else {
        if (params?.from) searchParams.set('from', params.from)
        if (params?.to) searchParams.set('to', params.to)
    }

    const query = searchParams.toString()
    const url = query ? `${SERVER_URL}/dashboard?${query}` : `${SERVER_URL}/dashboard`

    const res = await fetch(url)
    return parseApiResponse<DashboardOverview>(res)
}

export async function patchInboxItemRead(id: string, isRead: boolean): Promise<{ok: true; id: string; isRead: boolean}> {
    const res = await fetch(`${SERVER_URL}/dashboard/inbox/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({isRead}),
    })
    return parseApiResponse(res)
}

export async function markAllInboxRead(params?: DashboardTimeRangeQuery): Promise<{ok: true; count: number}> {
    const searchParams = new URLSearchParams()
    if (params?.timeRangePreset) {
        searchParams.set('timeRangePreset', params.timeRangePreset)
    } else {
        if (params?.from) searchParams.set('from', params.from)
        if (params?.to) searchParams.set('to', params.to)
    }
    const query = searchParams.toString()
    const url = query
        ? `${SERVER_URL}/dashboard/inbox/mark-all-read?${query}`
        : `${SERVER_URL}/dashboard/inbox/mark-all-read`

    const res = await fetch(url, {method: 'PATCH'})
    return parseApiResponse(res)
}
