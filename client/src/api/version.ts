import type {AppVersionResponse} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function getAppVersion(): Promise<AppVersionResponse> {
    const res = await fetch(`${SERVER_URL}/version`)
    return parseApiResponse<AppVersionResponse>(res)
}
