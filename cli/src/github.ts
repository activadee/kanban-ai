import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {cleanVersionTag} from './version'

export interface GithubAsset {
    name: string
    browser_download_url: string
}

export interface GithubRelease {
    tag_name: string
    body?: string | null
    assets: GithubAsset[]
}

export type GithubCacheOptions = {
    dir: string
    ttlMs?: number
    now?: number
}

export type GithubRequestOptions = {
    cache?: GithubCacheOptions
}

export type GithubFetchMeta = {
    source: 'network' | 'cache' | 'stale-cache'
    warning?: string
}

export type GithubReleaseResult = {
    version: string
    release: GithubRelease
    meta?: GithubFetchMeta
}

export class GithubRateLimitError extends Error {
    status: number
    retryAfterSeconds?: number
    rateLimitResetSeconds?: number

    constructor(
        message: string,
        options: {
            status: number
            retryAfterSeconds?: number
            rateLimitResetSeconds?: number
        },
    ) {
        super(message)
        this.name = 'GithubRateLimitError'
        this.status = options.status
        this.retryAfterSeconds = options.retryAfterSeconds
        this.rateLimitResetSeconds = options.rateLimitResetSeconds
    }
}

const GITHUB_API_BASE = 'https://api.github.com'
const DEFAULT_CACHE_TTL_MS = 30 * 60_000

type GithubApiCacheEntry<T> = {
    etag?: string
    fetchedAt: number
    data: T
}

type RateLimitInfo = {
    retryAfterSeconds?: number
    rateLimitResetSeconds?: number
    rateLimitRemaining?: number
}

function nowMs(cache?: GithubCacheOptions): number {
    return cache?.now ?? Date.now()
}

function resolveTtlMs(cache?: GithubCacheOptions): number {
    if (cache?.ttlMs === undefined) return DEFAULT_CACHE_TTL_MS
    return cache.ttlMs
}

function isFresh(entry: GithubApiCacheEntry<unknown>, ttlMs: number, now: number): boolean {
    if (entry.fetchedAt > now) return false
    return now - entry.fetchedAt < ttlMs
}

function cacheFilePath(cacheDir: string, repo: string, apiPath: string): string {
    const baseDir = path.resolve(cacheDir)
    const repoKey = repo.replace(/[^a-zA-Z0-9._-]+/g, '__')
    const repoHash = createHash('sha256').update(repo).digest('hex').slice(0, 12)
    const repoSafe = repoKey === '' || repoKey === '.' || repoKey === '..' ? `repo-${repoHash}` : repoKey

    const key = createHash('sha256')
        .update(`${GITHUB_API_BASE}${apiPath}`)
        .digest('hex')
        .slice(0, 32)

    const fileName = `${key}.json`
    const candidate = path.resolve(baseDir, repoSafe, fileName)

    if (!candidate.startsWith(`${baseDir}${path.sep}`)) {
        return path.join(baseDir, `repo-${repoHash}`, fileName)
    }

    return candidate
}

async function readCacheEntry<T>(filePath: string): Promise<GithubApiCacheEntry<T> | null> {
    try {
        const raw = await fs.promises.readFile(filePath, 'utf8')
        const parsed = JSON.parse(raw) as GithubApiCacheEntry<T>
        if (!parsed || typeof parsed !== 'object') return null
        if (typeof (parsed as any).fetchedAt !== 'number') return null
        if (!('data' in (parsed as any))) return null
        return parsed
    } catch {
        return null
    }
}

async function tryUnlink(filePath: string): Promise<boolean> {
    try {
        await fs.promises.unlink(filePath)
        return true
    } catch {
        return false
    }
}

async function tryRename(from: string, to: string): Promise<boolean> {
    try {
        await fs.promises.rename(from, to)
        return true
    } catch {
        return false
    }
}

async function tryCopyFile(from: string, to: string): Promise<boolean> {
    try {
        await fs.promises.copyFile(from, to)
        return true
    } catch {
        return false
    }
}

async function writeCacheEntry<T>(filePath: string, entry: GithubApiCacheEntry<T>): Promise<void> {
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`

    try {
        await fs.promises.mkdir(path.dirname(filePath), {recursive: true})
        await fs.promises.writeFile(tmpPath, JSON.stringify(entry), 'utf8')

        if (await tryRename(tmpPath, filePath)) return
        if (await tryCopyFile(tmpPath, filePath)) return

        await tryUnlink(filePath)
        await tryRename(tmpPath, filePath)
    } catch {
        return
    } finally {
        await tryUnlink(tmpPath)
    }
}

function parseRateLimitInfo(res: Response): RateLimitInfo {
    const retryAfterRaw = res.headers.get('retry-after')
    const resetRaw = res.headers.get('x-ratelimit-reset')
    const remainingRaw = res.headers.get('x-ratelimit-remaining')

    const retryAfterSeconds = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined
    const rateLimitResetSeconds = resetRaw ? Number.parseInt(resetRaw, 10) : undefined
    const rateLimitRemaining = remainingRaw ? Number.parseInt(remainingRaw, 10) : undefined

    return {
        retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        rateLimitResetSeconds: Number.isFinite(rateLimitResetSeconds) ? rateLimitResetSeconds : undefined,
        rateLimitRemaining: Number.isFinite(rateLimitRemaining) ? rateLimitRemaining : undefined,
    }
}

function formatWaitMs(ms: number): string {
    const seconds = Math.ceil(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.ceil(seconds / 60)
    return `${minutes}m`
}

function formatRateLimitMessage(info: RateLimitInfo, now: number): string {
    if (info.retryAfterSeconds && info.retryAfterSeconds > 0) {
        return `GitHub API rate limited (retry after ${formatWaitMs(info.retryAfterSeconds * 1000)}).`
    }

    if (info.rateLimitRemaining === 0 && info.rateLimitResetSeconds) {
        const resetAtMs = info.rateLimitResetSeconds * 1000
        const waitMs = Math.max(0, resetAtMs - now)
        const resetIso = new Date(resetAtMs).toISOString()
        return `GitHub API rate limit exceeded (resets at ${resetIso}, ~${formatWaitMs(waitMs)}).`
    }

    return 'GitHub API is temporarily rate limiting requests.'
}

function isRedirectStatus(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function assertAllowedRedirectUrl(url: string): void {
    const parsed = new URL(url)

    if (parsed.protocol !== 'https:') {
        throw new Error(`Unexpected redirect protocol: ${parsed.protocol}`)
    }

    if (parsed.hostname === 'github.com') {
        return
    }

    if (parsed.hostname.endsWith('.githubusercontent.com')) {
        return
    }

    throw new Error(`Unexpected redirect host: ${parsed.hostname}`)
}

function extractTagFromDownloadUrl(url: string): string | null {
    try {
        const u = new URL(url)
        const parts = u.pathname.split('/').filter(Boolean)
        const downloadIdx = parts.indexOf('download')
        if (downloadIdx <= 0) return null
        if (parts[downloadIdx - 1] !== 'releases') return null
        const tag = parts[downloadIdx + 1]
        return tag || null
    } catch {
        return null
    }
}

async function githubFetchJson<T>(
    repo: string,
    apiPath: string,
    options?: GithubRequestOptions,
): Promise<{data: T; meta?: GithubFetchMeta}> {
    const url = `${GITHUB_API_BASE}${apiPath}`

    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'kanban-ai-cli',
    }

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    const cache = options?.cache
    const ttlMs = resolveTtlMs(cache)
    const now = nowMs(cache)

    const filePath = cache ? cacheFilePath(cache.dir, repo, apiPath) : null
    const cached = filePath ? await readCacheEntry<T>(filePath) : null

    if (cached && isFresh(cached, ttlMs, now)) {
        return {data: cached.data, meta: {source: 'cache'}}
    }

    if (cached?.etag) {
        headers['If-None-Match'] = cached.etag
    }

    const res = await fetch(url, {
        headers,
        redirect: 'follow',
    })

    if (res.status === 304 && cached) {
        if (filePath) {
            const etag = res.headers.get('etag') || cached.etag
            await writeCacheEntry(filePath, {
                etag: etag || undefined,
                fetchedAt: now,
                data: cached.data,
            })
        }
        return {data: cached.data, meta: {source: 'cache'}}
    }

    if (!res.ok) {
        const info = res.status === 403 || res.status === 429 ? parseRateLimitInfo(res) : null
        const body = await res.text().catch(() => '')
        const bodySnippet = body ? body.slice(0, 500) : ''

        const looksLikeRateLimit =
            res.status === 429 ||
            /rate limit/i.test(bodySnippet) ||
            Boolean(info?.retryAfterSeconds) ||
            info?.rateLimitRemaining === 0

        if (looksLikeRateLimit && info && cached) {
            return {
                data: cached.data,
                meta: {
                    source: 'stale-cache',
                    warning: `${formatRateLimitMessage(info, now)} Tip: set GITHUB_TOKEN or GH_TOKEN for higher GitHub rate limits.`,
                },
            }
        }

        if (looksLikeRateLimit && info) {
            const message = `${formatRateLimitMessage(info, now)} Tip: set GITHUB_TOKEN or GH_TOKEN for higher GitHub rate limits.`
            throw new GithubRateLimitError(message, {
                status: res.status,
                retryAfterSeconds: info.retryAfterSeconds,
                rateLimitResetSeconds: info.rateLimitResetSeconds,
            })
        }

        throw new Error(
            `GitHub API request failed: ${res.status} ${res.statusText}${bodySnippet ? ` - ${bodySnippet}` : ''}`,
        )
    }

    const json = (await res.json()) as T

    if (filePath) {
        const etag = res.headers.get('etag') || undefined
        await writeCacheEntry(filePath, {etag, fetchedAt: now, data: json})
    }

    return {data: json, meta: {source: 'network'}}
}

export async function getLatestRelease(repo: string, options?: GithubRequestOptions): Promise<GithubReleaseResult> {
    const result = await githubFetchJson<GithubRelease>(
        repo,
        `/repos/${repo}/releases/latest`,
        options,
    )
    const version = cleanVersionTag(result.data.tag_name)
    return {version, release: result.data, meta: result.meta}
}

export async function getReleaseByVersion(repo: string, version: string, options?: GithubRequestOptions): Promise<GithubReleaseResult> {
    const tag = version.startsWith('v') ? version : `v${version}`
    const result = await githubFetchJson<GithubRelease>(
        repo,
        `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
        options,
    )
    const resolvedVersion = cleanVersionTag(result.data.tag_name)
    return {version: resolvedVersion, release: result.data, meta: result.meta}
}

export type GithubReleaseRedirect = {
    tag: string
    version: string
    assetName: string
    url: string
}

export async function resolveLatestReleaseAssetViaRedirect(
    repo: string,
    assetNameCandidates: string[],
): Promise<GithubReleaseRedirect> {
    for (const assetName of assetNameCandidates) {
        const latestUrl = `https://github.com/${repo}/releases/latest/download/${assetName}`
        const res = await fetch(latestUrl, {redirect: 'manual', method: 'HEAD'})

        if (!isRedirectStatus(res.status)) {
            continue
        }

        const firstLocation = res.headers.get('location')
        if (!firstLocation) {
            continue
        }

        const releaseUrl = new URL(firstLocation, latestUrl).toString()
        assertAllowedRedirectUrl(releaseUrl)

        const tag = extractTagFromDownloadUrl(releaseUrl)
        if (!tag) {
            continue
        }

        const res2 = await fetch(releaseUrl, {redirect: 'manual', method: 'HEAD'})
        if (!isRedirectStatus(res2.status)) {
            if (res2.status >= 200 && res2.status < 300) {
                return {tag, version: cleanVersionTag(tag), assetName, url: releaseUrl}
            }

            continue
        }

        const secondLocation = res2.headers.get('location')
        if (!secondLocation) {
            continue
        }

        const assetUrl = new URL(secondLocation, releaseUrl).toString()
        assertAllowedRedirectUrl(assetUrl)

        return {tag, version: cleanVersionTag(tag), assetName, url: assetUrl}
    }

    throw new Error(
        `Could not resolve latest release download URL for ${repo} (tried: ${assetNameCandidates.join(', ')})`,
    )
}

export async function resolveReleaseAssetViaRedirect(
    repo: string,
    version: string,
    assetNameCandidates: string[],
): Promise<GithubReleaseRedirect> {
    const tag = version.startsWith('v') ? version : `v${version}`

    for (const assetName of assetNameCandidates) {
        const releaseUrl = `https://github.com/${repo}/releases/download/${tag}/${assetName}`
        const res = await fetch(releaseUrl, {redirect: 'manual', method: 'HEAD'})

        if (!isRedirectStatus(res.status)) {
            if (res.status >= 200 && res.status < 300) {
                return {
                    tag,
                    version: cleanVersionTag(tag),
                    assetName,
                    url: releaseUrl,
                }
            }

            continue
        }

        const location = res.headers.get('location')
        if (!location) {
            continue
        }

        const assetUrl = new URL(location, releaseUrl).toString()
        assertAllowedRedirectUrl(assetUrl)

        return {
            tag,
            version: cleanVersionTag(tag),
            assetName,
            url: assetUrl,
        }
    }

    throw new Error(
        `Could not resolve release download URL for ${repo}@${tag} (tried: ${assetNameCandidates.join(', ')})`,
    )
}
