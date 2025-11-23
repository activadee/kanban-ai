import type {PRInfo} from 'shared'
import {getGitOriginUrl, parseGithubOwnerRepo} from 'core'
import {projectsRepo} from 'core'

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
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`)
    url.searchParams.set('state', state)
    url.searchParams.set('per_page', '50')
    const trimmedBranch = branch?.trim()
    if (trimmedBranch) url.searchParams.set('head', `${owner}:${trimmedBranch}`)
    const res = await fetch(url.toString(), {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub PR lookup failed (${res.status}): ${text}`)
    }
    const data = (await res.json()) as Array<any>
    return data.map(mapGithubPr)
}

export async function getPullRequest(projectId: string, token: string, number: number): Promise<PRInfo> {
    const {owner, repo} = await getOwnerRepo(projectId)
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub PR fetch failed (${res.status}): ${text}`)
    }
    const data = (await res.json()) as any
    return mapGithubPr(data)
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
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({base, head, title, body, draft: Boolean(draft)}),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub PR create failed (${res.status}): ${text}`)
    }
    const data = (await res.json()) as any
    return mapGithubPr(data)
}
