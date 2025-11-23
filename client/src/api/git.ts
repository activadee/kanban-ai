// (no project-scoped git types used here now)
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function getFileContent(projectId: string, path: string, source: 'worktree' | 'index' | 'head' | 'base'): Promise<string | null> {
    const url = new URL(`${SERVER_URL}/projects/${projectId}/git/file`)
    url.searchParams.set('path', path)
    url.searchParams.set('source', source)
    const res = await fetch(url.toString())
    const data = await parseApiResponse<{ content: string | null }>(res)
    return data.content
}

// Attempt/worktree-scoped endpoints
export async function getAttemptGitStatus(attemptId: string): Promise<import('shared').GitStatus> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/git/status`)
    return parseApiResponse(res)
}

export async function getAttemptFileContent(attemptId: string, path: string, source: 'worktree' | 'index' | 'head' | 'base'): Promise<string | null> {
    const url = new URL(`${SERVER_URL}/attempts/${attemptId}/git/file`)
    url.searchParams.set('path', path)
    url.searchParams.set('source', source)
    const res = await fetch(url.toString())
    const data = await parseApiResponse<{ content: string | null }>(res)
    return data.content
}

type CommitResponse = { shortSha: string }

export async function commitAttempt(attemptId: string, subject: string, body?: string): Promise<CommitResponse> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/git/commit`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subject, body}),
    })
    const data = await parseApiResponse<CommitResponse>(res)
    if (!data || !data.shortSha) {
        throw new Error('Commit response missing short SHA')
    }
    return data
}

type PushResponse = { remote: string; branch: string }

export async function pushAttempt(attemptId: string, setUpstream?: boolean): Promise<PushResponse> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/git/push`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({setUpstream: Boolean(setUpstream)}),
    })
    const data = await parseApiResponse<PushResponse>(res)
    if (!data || !data.remote || !data.branch) {
        throw new Error('Push response missing remote or branch')
    }
    return data
}

export async function createAttemptPR(attemptId: string, payload: {
    base?: string;
    title: string;
    body?: string;
    draft?: boolean
}): Promise<import('shared').PRInfo> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/github/pr`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    const data = await parseApiResponse<{ pr: import('shared').PRInfo | null }>(res)
    if (!data?.pr) {
        throw new Error('PR response missing payload')
    }
    return data.pr
}
