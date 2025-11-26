import {cleanVersionTag} from './version'

export interface GithubAsset {
    name: string
    browser_download_url: string
}

export interface GithubRelease {
    tag_name: string
    assets: GithubAsset[]
}

const GITHUB_API_BASE = 'https://api.github.com'

async function githubFetch(path: string): Promise<Response> {
    const url = `${GITHUB_API_BASE}${path}`

    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'kanban-ai-cli',
    }

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(url, {
        headers,
        redirect: 'follow',
    })

    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}${body ? ` - ${body}` : ''}`)
    }

    return res
}

export async function getLatestRelease(repo: string): Promise<{version: string; release: GithubRelease}> {
    const res = await githubFetch(`/repos/${repo}/releases/latest`)
    const json = (await res.json()) as GithubRelease
    const version = cleanVersionTag(json.tag_name)
    return {version, release: json}
}

export async function getReleaseByVersion(repo: string, version: string): Promise<GithubRelease> {
    const tag = version.startsWith('v') ? version : `v${version}`
    const res = await githubFetch(`/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`)
    return (await res.json()) as GithubRelease
}
