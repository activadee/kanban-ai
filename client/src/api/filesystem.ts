import type {GitRepositoryEntry} from 'shared'
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

export async function discoverGitRepositories(path?: string): Promise<GitRepositoryEntry[]> {
    const url = new URL(`${SERVER_URL}/filesystem/git-repos`)
    if (path) url.searchParams.set('path', path)
    const res = await fetch(url.toString())
    const payload = await parseJson<{ entries: GitRepositoryEntry[] }>(res)
    return payload.entries ?? []
}
