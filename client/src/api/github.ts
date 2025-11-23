import type {
    GitHubCheckResponse,
    GitHubDevicePollResponse,
    GitHubDeviceStartResponse,
    GithubAppConfig,
    UpsertGithubAppConfigRequest,
} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function checkGitHubDevice(): Promise<GitHubCheckResponse> {
    const res = await fetch(`${SERVER_URL}/auth/github/check`)
    return parseApiResponse<GitHubCheckResponse>(res)
}

export async function startGitHubDevice(): Promise<GitHubDeviceStartResponse> {
    const res = await fetch(`${SERVER_URL}/auth/github/device/start`, {
        method: 'POST',
    })
    return parseApiResponse<GitHubDeviceStartResponse>(res)
}

export async function pollGitHubDevice(): Promise<GitHubDevicePollResponse> {
    const res = await fetch(`${SERVER_URL}/auth/github/device/poll`, {
        method: 'POST',
    })
    return parseApiResponse<GitHubDevicePollResponse>(res)
}

export async function logoutGitHub(): Promise<void> {
    const res = await fetch(`${SERVER_URL}/auth/github/logout`, {method: 'POST'})
    await parseApiResponse(res)
}

export async function getGithubAppConfig(): Promise<GithubAppConfig> {
    const res = await fetch(`${SERVER_URL}/auth/github/app`)
    return parseApiResponse<GithubAppConfig>(res)
}

export async function putGithubAppConfig(payload: UpsertGithubAppConfigRequest): Promise<GithubAppConfig> {
    const res = await fetch(`${SERVER_URL}/auth/github/app`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    return parseApiResponse<GithubAppConfig>(res)
}
