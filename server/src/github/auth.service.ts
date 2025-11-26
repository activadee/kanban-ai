import type {GitHubCheckResponse, GitHubDevicePollResponse, GitHubDeviceStartResponse} from 'shared'
import {githubRepo} from 'core'
import {runtimeEnv} from '../env'
import type {RuntimeEnv} from '../env'
import {exchangeDeviceCodeForToken, fetchGithubAccount, requestDeviceCode} from './github-client'

const {getGithubConnection, upsertGithubConnection, getGithubAppConfig} = githubRepo

const DEFAULT_SCOPE = 'repo user:email'

type DeviceFlowSession = {
    deviceCode: string
    userCode: string
    verificationUri: string
    verificationUriComplete: string | null
    interval: number
    nextPollAt: number
    expiresAt: number
}

let currentSession: DeviceFlowSession | null = null

type GithubClientConfig = { clientId: string; clientSecret: string | null }

async function loadGithubClient(env: RuntimeEnv = runtimeEnv()): Promise<GithubClientConfig> {
    const stored = await getGithubAppConfig()
    const clientId = stored?.clientId?.trim() || env.GITHUB_CLIENT_ID?.trim()
    const clientSecret = stored?.clientSecret?.trim() || env.GITHUB_CLIENT_SECRET?.trim() || null
    if (!clientId) {
        throw new Error('GitHub OAuth client is not configured. Add a client ID in settings or set GITHUB_CLIENT_ID.')
    }
    return {clientId, clientSecret}
}

export async function startGithubDeviceFlow(env: RuntimeEnv = runtimeEnv()): Promise<GitHubDeviceStartResponse> {
    const {clientId} = await loadGithubClient(env)
    const json = await requestDeviceCode({clientId, scope: DEFAULT_SCOPE})

    const now = Date.now()
    currentSession = {
        deviceCode: json.device_code,
        userCode: json.user_code,
        verificationUri: json.verification_uri,
        verificationUriComplete: json.verification_uri_complete ?? null,
        interval: json.interval,
        nextPollAt: now, // first poll can happen immediately
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

export async function pollGithubDeviceFlow(env: RuntimeEnv = runtimeEnv()): Promise<GitHubDevicePollResponse> {
    if (!currentSession) {
        return {status: 'error', message: 'Device flow not started'}
    }
    if (Date.now() >= currentSession.expiresAt) {
        currentSession = null
        return {status: 'expired'}
    }

    const now = Date.now()
    if (now < currentSession.nextPollAt) {
        const retryAfterSeconds = Math.max(1, Math.ceil((currentSession.nextPollAt - now) / 1000))
        return {status: 'slow_down', retryAfterSeconds}
    }

    const {clientId, clientSecret} = await loadGithubClient(env)

    // Enforce per-session interval locally to avoid hammering GitHub if the UI misbehaves
    currentSession.nextPollAt = now + currentSession.interval * 1000

    let json
    try {
        json = await exchangeDeviceCodeForToken({
            clientId,
            clientSecret,
            deviceCode: currentSession.deviceCode,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'GitHub token exchange failed'
        return {status: 'error', message}
    }

    if ('error' in json) {
        switch (json.error) {
            case 'authorization_pending':
                currentSession.nextPollAt = now + currentSession.interval * 1000
                return {status: 'authorization_pending'}
            case 'slow_down':
                currentSession.nextPollAt = now + (currentSession.interval + 5) * 1000
                return {status: 'slow_down', retryAfterSeconds: Math.ceil((currentSession.nextPollAt - now) / 1000)}
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

    // Success; prevent any further polls for this session
    currentSession = null

    const account = await fetchGithubAccount(json.access_token)
    await upsertGithubConnection({
        username: account.username,
        primaryEmail: account.primaryEmail,
        accessToken: json.access_token,
        tokenType: json.token_type,
        scope: json.scope ?? null,
    })
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

