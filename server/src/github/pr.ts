import type {PRInfo} from 'shared'
import {getGitOriginUrl, parseGithubOwnerRepo} from 'core'
import {projectsRepo} from 'core'
import {githubApiJson} from './github-client'

const {getRepositoryPath} = projectsRepo

type PullRequestState = 'open' | 'closed' | 'all'

type ListPullRequestsOptions = {
    state?: PullRequestState
    branch?: string | null
}

async function getOwnerRepo(projectId: string): Promise<{ owner: string; repo: string }> {
    const repositoryPath = await getRepositoryPath(projectId)
    if (!repositoryPath) throw new Error('Project not found')
    const origin = await getGitOriginUrl(repositoryPath)
    if (!origin) throw new Error('No origin remote configured')
    const parsed = parseGithubOwnerRepo(origin)
    if (!parsed) throw new Error('Unsupported remote origin for GitHub operations')
    return parsed
}

function mapGithubPr(raw: any): PRInfo {
    return {
        number: raw?.number,
        url: raw?.html_url,
        state: raw?.state,
        draft: Boolean(raw?.draft),
        title: raw?.title,
        headRef: raw?.head?.ref,
        baseRef: raw?.base?.ref,
        createdAt: raw?.created_at,
        updatedAt: raw?.updated_at,
        merged: Boolean(raw?.merged_at),
    }
}

export async function listPullRequests(
    projectId: string,
    token: string,
    {state = 'open', branch}: ListPullRequestsOptions = {},
): Promise<PRInfo[]> {
    const {owner, repo} = await getOwnerRepo(projectId)
    try {
        const trimmedBranch = branch?.trim()
        const data = await githubApiJson<Array<any>>({
            path: `/repos/${owner}/${repo}/pulls`,
            token,
            searchParams: {
                state,
                per_page: '50',
                head: trimmedBranch ? `${owner}:${trimmedBranch}` : undefined,
            },
        })
        return data.map(mapGithubPr)
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(error.message.replace('GitHub API request failed', 'GitHub PR lookup failed'))
        }
        throw error
    }
}

export async function getPullRequest(projectId: string, token: string, number: number): Promise<PRInfo> {
    const {owner, repo} = await getOwnerRepo(projectId)
    try {
        const data = await githubApiJson<any>({
            path: `/repos/${owner}/${repo}/pulls/${number}`,
            token,
        })
        return mapGithubPr(data)
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(error.message.replace('GitHub API request failed', 'GitHub PR fetch failed'))
        }
        throw error
    }
}

export async function findOpenPR(projectId: string, token: string, branch: string): Promise<PRInfo | null> {
    const prs = await listPullRequests(projectId, token, {state: 'open', branch})
    return prs[0] ?? null
}

export async function createPR(
    projectId: string,
    token: string,
    {base, head, title, body, draft}: { base: string; head: string; title: string; body?: string; draft?: boolean },
): Promise<PRInfo> {
    const {owner, repo} = await getOwnerRepo(projectId)
    try {
        const data = await githubApiJson<any>({
            path: `/repos/${owner}/${repo}/pulls`,
            token,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({base, head, title, body, draft: Boolean(draft)}),
        })
        return mapGithubPr(data)
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(error.message.replace('GitHub API request failed', 'GitHub PR create failed'))
        }
        throw error
    }
}
