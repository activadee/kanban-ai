import type {GitHubCheckResponse, GitHubDevicePollResponse, GitHubDeviceStartResponse} from 'shared'
import {SERVER_URL} from '@/lib/env'

async function parseJson<T>(response: Response): Promise<T> {
    const text = await response.text()
    let data: unknown = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        // Non-JSON response body
    }
    if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data ? (data as { error?: string }).error : null
        throw new Error(message || `Request failed with status ${response.status}`)
    }
    return data as T
}

export async function checkGitHubDevice(): Promise<GitHubCheckResponse> {
    const res = await fetch(`${SERVER_URL}/auth/github/check`)
    return parseJson<GitHubCheckResponse>(res)
}

export async function startGitHubDevice(): Promise<GitHubDeviceStartResponse> {
    const res = await fetch(`${SERVER_URL}/auth/github/device/start`, {
        method: 'POST',
    })
    return parseJson<GitHubDeviceStartResponse>(res)
}

export async function pollGitHubDevice(): Promise<GitHubDevicePollResponse> {
    const res = await fetch(`${SERVER_URL}/auth/github/device/poll`, {
        method: 'POST',
    })
    return parseJson<GitHubDevicePollResponse>(res)
}

export async function logoutGitHub(): Promise<void> {
    const res = await fetch(`${SERVER_URL}/auth/github/logout`, {method: 'POST'})
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `GitHub logout failed (${res.status})`)
    }
}
