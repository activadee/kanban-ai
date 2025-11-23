import type {DashboardOverview} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function getDashboardOverview(): Promise<DashboardOverview> {
    const res = await fetch(`${SERVER_URL}/dashboard`)
    return parseApiResponse<DashboardOverview>(res)
}
