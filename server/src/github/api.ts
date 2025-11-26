import {githubRepo} from 'core'
import {githubApiJson} from './github-client'

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

async function requireToken(): Promise<string> {
    const conn = await getGithubConnection()
    if (!conn) throw new Error('GitHub not connected')
    if (!conn.accessToken) throw new Error('GitHub token missing')
    return conn.accessToken
}

export async function listUserRepos(): Promise<GithubRepo[]> {
    const token = await requireToken()
    try {
        const payload = await githubApiJson<GithubRepo[]>({
            path: '/user/repos',
            token,
            searchParams: {
                per_page: '100',
                sort: 'updated',
            },
        })
        return payload
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(error.message.replace('GitHub API request failed', 'GitHub repos fetch failed'))
        }
        throw error
    }
}

export async function fetchRepoIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    const token = await requireToken()
    try {
        const payload = await githubApiJson<GithubIssue[]>({
            path: `/repos/${owner}/${repo}/issues`,
            token,
            searchParams: {
                state,
                per_page: '100',
            },
        })
        // Exclude PRs which have the pull_request field
        return payload.filter((it) => !('pull_request' in it))
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(error.message.replace('GitHub API request failed', 'GitHub issues fetch failed'))
        }
        throw error
    }
}
