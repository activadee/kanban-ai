import type {GitRepositoryEntry} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function discoverGitRepositories(path?: string): Promise<GitRepositoryEntry[]> {
    const url = new URL(`${SERVER_URL}/fs/git-repos`)
    if (path) url.searchParams.set('path', path)
    const res = await fetch(url.toString())
    const payload = await parseApiResponse<{ entries: GitRepositoryEntry[] }>(res)
    return payload.entries ?? []
}
