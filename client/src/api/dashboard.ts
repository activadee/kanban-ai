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
