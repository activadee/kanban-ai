import {githubRepo} from 'core'

const {getGithubConnection} = githubRepo

export type GithubRepo = {
    id: number
    name: string
    full_name: string
    private: boolean
    html_url: string
    default_branch: string
    owner: { login: string }
}

export type GithubIssue = {
    id: number
    number: number
    title: string
    body?: string | null
    html_url: string
    state: 'open' | 'closed'
    pull_request?: unknown
}

function ghHeaders(token: string) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'kanbanai-app',
    }
}

async function requireToken(): Promise<string> {
    const conn = await getGithubConnection()
    if (!conn) throw new Error('GitHub not connected')
    if (!conn.accessToken) throw new Error('GitHub token missing')
    return conn.accessToken
}

export async function listUserRepos(): Promise<GithubRepo[]> {
    const token = await requireToken()
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: ghHeaders(token),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub repos fetch failed (${res.status}): ${text}`)
    }
    const payload = (await res.json()) as GithubRepo[]
    return payload
}

export async function fetchRepoIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    const token = await requireToken()
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`)
    url.searchParams.set('state', state)
    url.searchParams.set('per_page', '100')
    const res = await fetch(url, {headers: ghHeaders(token)})
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub issues fetch failed (${res.status}): ${text}`)
    }
    const payload = (await res.json()) as GithubIssue[]
    // Exclude PRs which have the pull_request field
    return payload.filter((it) => !('pull_request' in it))
}
