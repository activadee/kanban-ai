import type {PRInfo} from 'shared'
import {getGitOriginUrl, parseGithubOwnerRepo} from 'core'
import {projectsRepo} from 'core'

const {getRepositoryPath} = projectsRepo

async function getOwnerRepo(projectId: string): Promise<{ owner: string; repo: string }> {
    const repositoryPath = await getRepositoryPath(projectId)
    if (!repositoryPath) throw new Error('Project not found')
    const origin = await getGitOriginUrl(repositoryPath)
    if (!origin) throw new Error('No origin remote configured')
    const parsed = parseGithubOwnerRepo(origin)
    if (!parsed) throw new Error('Unsupported remote origin for GitHub operations')
    return parsed
}

export async function findOpenPR(projectId: string, token: string, branch: string): Promise<PRInfo | null> {
    const {owner, repo} = await getOwnerRepo(projectId)
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`)
    url.searchParams.set('state', 'open')
    url.searchParams.set('head', `${owner}:${branch}`)
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
    const first = data[0]
    if (!first) return null
    return {
        number: first.number,
        url: first.html_url,
        state: first.state,
        draft: Boolean(first.draft),
    }
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
    return {
        number: data.number,
        url: data.html_url,
        state: data.state,
        draft: Boolean(data.draft),
    }
}
