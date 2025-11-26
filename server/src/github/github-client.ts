import {log} from '../log'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_DEVICE_BASE = 'https://github.com'

const USER_AGENT = 'kanbanai-app'
const API_VERSION = '2022-11-28'

export type GithubDeviceCodeResponse = {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete?: string
    expires_in: number
    interval: number
}

export type GithubAccessTokenSuccess = {
    access_token: string
    token_type: string
    scope?: string
}

export type GithubAccessTokenError = {
    error: string
    error_description?: string
}

export type GithubAccessTokenResponse = GithubAccessTokenSuccess | GithubAccessTokenError

type GithubApiFetchOptions = {
    path: string
    token: string
    method?: string
    searchParams?: Record<string, string | undefined>
    headers?: Record<string, string>
    body?: any
}

export async function githubApiFetch(options: GithubApiFetchOptions): Promise<Response> {
    const {path, token, method = 'GET', searchParams, headers, body} = options
    const url =
        path.startsWith('http://') || path.startsWith('https://')
            ? new URL(path)
            : new URL(path, GITHUB_API_BASE)

    if (searchParams) {
        for (const [key, value] of Object.entries(searchParams)) {
            if (value !== undefined) {
                url.searchParams.set(key, value)
            }
        }
    }

    const baseHeaders: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': API_VERSION,
        Authorization: `Bearer ${token}`,
    }

    return fetch(url.toString(), {
        method,
        headers: {...baseHeaders, ...headers},
        body: body ?? undefined,
    })
}

export async function githubApiJson<T>(options: GithubApiFetchOptions): Promise<T> {
    const res = await githubApiFetch(options)
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub API request failed (${res.status}): ${text}`)
    }
    return res.json() as Promise<T>
}

export async function requestDeviceCode(params: {
    clientId: string
    scope: string
}): Promise<GithubDeviceCodeResponse> {
    const body = new URLSearchParams({client_id: params.clientId, scope: params.scope})

    const res = await fetch(`${GITHUB_DEVICE_BASE}/login/device/code`, {
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

    const json = (await res.json()) as GithubDeviceCodeResponse
    return json
}

export async function exchangeDeviceCodeForToken(params: {
    clientId: string
    clientSecret: string | null
    deviceCode: string
}): Promise<GithubAccessTokenResponse> {
    const body = new URLSearchParams({
        client_id: params.clientId,
        device_code: params.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })

    if (params.clientSecret) {
        body.set('client_secret', params.clientSecret)
    }

    const res = await fetch(`${GITHUB_DEVICE_BASE}/login/oauth/access_token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body,
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub token exchange failed (${res.status}): ${text}`)
    }

    const json = (await res.json()) as GithubAccessTokenResponse
    return json
}

export async function fetchGithubAccount(token: string): Promise<{
    username: string
    primaryEmail: string | null
}> {
    const user = await githubApiJson<{ login: string }>({
        path: '/user',
        token,
    })

    let primaryEmail: string | null = null
    try {
        const emails = await githubApiJson<Array<{ email: string; primary: boolean }>>({
            path: '/user/emails',
            token,
        })
        const primary = emails.find((entry) => entry.primary)
        primaryEmail = primary?.email ?? null
    } catch (err) {
        log.error({err}, 'GitHub email lookup failed')
    }

    return {
        username: user.login,
        primaryEmail,
    }
}
