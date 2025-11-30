import {existsSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {AppVersionResponse} from 'shared'
import {runtimeEnv, type RuntimeEnv} from '../env'
import {log} from '../log'

const DEFAULT_REPO = 'activadee/kanban-ai'
const DEFAULT_TTL_MS = 15 * 60_000 // 15 minutes
const PACKAGE_NAME = 'kanban-ai'

type LatestCache = {
    repo: string
    latestVersion: string
    fetchedAt: number
    expiresAt: number
}

let cachedLatest: LatestCache | null = null

const sanitizeVersion = (value: string) => value.trim().replace(/^v/i, '')

const parsePackageJson = (path: string) => {
    try {
        const raw = readFileSync(path, 'utf8')
        return JSON.parse(raw) as {name?: string; version?: string}
    } catch (err) {
        log.warn('version', 'package.json parse failed', {err, path})
        return null
    }
}

const findVersionUpwards = (startDir: string): string | null => {
    let dir = startDir
    let fallback: string | null = null

    for (let depth = 0; depth < 6; depth++) {
        const pkgPath = resolve(dir, 'package.json')
        if (existsSync(pkgPath)) {
            const pkg = parsePackageJson(pkgPath)
            if (pkg?.version) {
                const sanitized = sanitizeVersion(pkg.version)
                if (pkg.name === PACKAGE_NAME) return sanitized
                if (!fallback) fallback = sanitized
            }
        }
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
    }

    return fallback
}

const resolveCurrentVersion = (env: RuntimeEnv): string => {
    const envVersion = env.KANBANAI_VERSION?.trim()
    if (envVersion) return sanitizeVersion(envVersion)

    // Prefer the repo root package (name === kanban-ai) but fall back to the nearest package.json
    const fromModule = findVersionUpwards(dirname(fileURLToPath(import.meta.url)))
    if (fromModule) return fromModule

    const fromCwd = findVersionUpwards(process.cwd())
    if (fromCwd) return fromCwd

    return '0.0.0-dev'
}

const resolveRepo = (env: RuntimeEnv) => env.KANBANAI_UPDATE_REPO?.trim() || DEFAULT_REPO
const resolveToken = (env: RuntimeEnv) => env.KANBANAI_UPDATE_TOKEN?.trim() || undefined
const resolveTtlMs = (env: RuntimeEnv) => {
    const raw = Number(env.KANBANAI_UPDATE_TTL_MS)
    if (Number.isFinite(raw) && raw > 0) return raw
    return DEFAULT_TTL_MS
}

const compareVersions = (a: string, b: string) => {
    const [aMain = '0', aPre] = sanitizeVersion(a).split('-', 2)
    const [bMain = '0', bPre] = sanitizeVersion(b).split('-', 2)

    const aParts = aMain.split('.').map((p) => Number.parseInt(p, 10) || 0)
    const bParts = bMain.split('.').map((p) => Number.parseInt(p, 10) || 0)
    const len = Math.max(aParts.length, bParts.length)

    for (let i = 0; i < len; i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
        if (diff !== 0) return diff
    }

    if (aPre && !bPre) return -1 // prerelease < release
    if (!aPre && bPre) return 1
    return 0
}

async function fetchLatestReleaseVersion(repo: string, token?: string): Promise<string> {
    const url = `https://api.github.com/repos/${repo}/releases/latest`
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'kanbanai-server',
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(url, {headers})
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`GitHub releases lookup failed (${res.status}): ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as {tag_name?: string; name?: string}
    const version = json.tag_name || json.name
    if (!version) {
        throw new Error('GitHub release did not include tag_name/name')
    }

    return sanitizeVersion(version)
}

const getCachedLatest = (repo: string, ttlMs: number, now: number) => {
    if (!cachedLatest) return null
    if (cachedLatest.repo !== repo) return null
    if (now > cachedLatest.expiresAt) return null
    return cachedLatest
}

const setLatestCache = (value: Omit<LatestCache, 'expiresAt'>, ttlMs: number) => {
    cachedLatest = {
        ...value,
        expiresAt: value.fetchedAt + ttlMs,
    }
}

export const clearVersionCache = () => {
    cachedLatest = null
}

export async function getAppVersionInfo(options?: {env?: RuntimeEnv; now?: number}): Promise<AppVersionResponse> {
    const env = options?.env ?? runtimeEnv()
    const now = options?.now ?? Date.now()
    const currentVersion = resolveCurrentVersion(env)
    const repo = resolveRepo(env)
    const token = resolveToken(env)
    const ttlMs = resolveTtlMs(env)

    const cached = getCachedLatest(repo, ttlMs, now)
    if (cached) {
        return {
            currentVersion,
            latestVersion: cached.latestVersion,
            updateAvailable: compareVersions(cached.latestVersion, currentVersion) > 0,
            checkedAt: new Date(cached.fetchedAt).toISOString(),
        }
    }

    let latestVersion = currentVersion
    let fetchedAt = now

    try {
        latestVersion = await fetchLatestReleaseVersion(repo, token)
        fetchedAt = Date.now()
    } catch (err) {
        log.warn('version', 'latest release lookup failed', {err, repo})
        // fall back to currentVersion; cache to avoid hammering on repeated failures
    }

    setLatestCache({repo, latestVersion, fetchedAt}, ttlMs)

    return {
        currentVersion,
        latestVersion,
        updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
        checkedAt: new Date(fetchedAt).toISOString(),
    }
}
