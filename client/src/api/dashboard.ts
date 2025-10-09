import type {DashboardOverview} from 'shared'
import {SERVER_URL} from '@/lib/env'

export async function getDashboardOverview(): Promise<DashboardOverview> {
    const res = await fetch(`${SERVER_URL}/dashboard`)
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to load dashboard overview')
    }
    return (await res.json()) as DashboardOverview
}
