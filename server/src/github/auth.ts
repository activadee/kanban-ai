import type {GitHubCheckResponse, GitHubDevicePollResponse, GitHubDeviceStartResponse} from 'shared'
import {githubRepo} from 'core'

const {getGithubConnection, upsertGithubConnection} = githubRepo

const USER_AGENT = 'kanbanai-app'
const DEFAULT_SCOPE = 'repo user:email'

type DeviceFlowSession = {
    deviceCode: string
    userCode: string
    verificationUri: string
    verificationUriComplete: string | null
    interval: number
    expiresAt: number
}

let currentSession: DeviceFlowSession | null = null

function getRequiredEnv(name: string): string {
    const value = Bun.env[name]
    if (!value || !value.trim()) {
        throw new Error(`${name} is required for GitHub OAuth device flow`)
    }
    return value.trim()
}

function getOptionalEnv(name: string): string | null {
    const value = Bun.env[name]
    return value && value.trim().length ? value.trim() : null
}

export async function startGithubDeviceFlow(): Promise<GitHubDeviceStartResponse> {
    const clientId = getRequiredEnv('GITHUB_CLIENT_ID')
    const body = new URLSearchParams({client_id: clientId, scope: DEFAULT_SCOPE})

    const res = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body,
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub device start failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as {
        device_code: string
        user_code: string
        verification_uri: string
        verification_uri_complete?: string
        expires_in: number
        interval: number
    }

    currentSession = {
        deviceCode: json.device_code,
        userCode: json.user_code,
        verificationUri: json.verification_uri,
        verificationUriComplete: json.verification_uri_complete ?? null,
        interval: json.interval,
        expiresAt: Date.now() + json.expires_in * 1000,
    }

    return {
        userCode: json.user_code,
        verificationUri: json.verification_uri,
        verificationUriComplete: json.verification_uri_complete ?? null,
        expiresIn: json.expires_in,
        interval: json.interval,
    }
}

async function fetchGithubAccount(token: string) {
    const baseHeaders = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
    }

    const userRes = await fetch('https://api.github.com/user', {
        headers: baseHeaders,
    })
    if (!userRes.ok) {
        const text = await userRes.text()
        throw new Error(`GitHub user lookup failed (${userRes.status}): ${text}`)
    }
    const userJson = (await userRes.json()) as { login: string }

    let primaryEmail: string | null = null
    try {
        const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: baseHeaders,
        })
        if (emailRes.ok) {
            const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean }>
            const primary = emails.find((entry) => entry.primary)
            primaryEmail = primary?.email ?? null
        }
    } catch (err) {
        console.error('GitHub email lookup failed', err)
    }

    return {
        username: userJson.login,
        primaryEmail,
    }
}

export async function pollGithubDeviceFlow(): Promise<GitHubDevicePollResponse> {
    if (!currentSession) {
        return {status: 'error', message: 'Device flow not started'}
    }
    if (Date.now() >= currentSession.expiresAt) {
        currentSession = null
        return {status: 'expired'}
    }

    const clientId = getRequiredEnv('GITHUB_CLIENT_ID')
    const clientSecret = getOptionalEnv('GITHUB_CLIENT_SECRET')

    const body = new URLSearchParams({
        client_id: clientId,
        device_code: currentSession.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })

    if (clientSecret) {
        body.set('client_secret', clientSecret)
    }

    const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body,
    })

    if (!res.ok) {
        const text = await res.text()
        return {status: 'error', message: `GitHub token exchange failed (${res.status}): ${text}`}
    }

    const json = (await res.json()) as
        | { access_token: string; token_type: string; scope?: string }
        | { error: string; error_description?: string }

    if ('error' in json) {
        switch (json.error) {
            case 'authorization_pending':
                return {status: 'authorization_pending'}
            case 'slow_down':
                return {status: 'slow_down'}
            case 'expired_token':
                currentSession = null
                return {status: 'expired'}
            case 'access_denied':
                currentSession = null
                return {status: 'access_denied'}
            default:
                return {status: 'error', message: json.error_description ?? json.error}
        }
    }

    const account = await fetchGithubAccount(json.access_token)
    await upsertGithubConnection({
        username: account.username,
        primaryEmail: account.primaryEmail,
        accessToken: json.access_token,
        tokenType: json.token_type,
        scope: json.scope ?? null,
    })
    currentSession = null
    return {
        status: 'success',
        account: {
            username: account.username,
            primaryEmail: account.primaryEmail,
            scope: json.scope ?? null,
        },
    }
}

export async function checkGithubConnection(): Promise<GitHubCheckResponse> {
    const connection = await getGithubConnection()
    if (!connection) {
        return {status: 'invalid'}
    }
    return {
        status: 'valid',
        account: {
            username: connection.username ?? '',
            primaryEmail: connection.primaryEmail ?? null,
            scope: connection.scope ?? null,
        },
    }
}
