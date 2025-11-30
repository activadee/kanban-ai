import {useQuery, type UseQueryOptions} from '@tanstack/react-query'
import {useMutation, type UseMutationOptions} from '@tanstack/react-query'
import type {PRInfo, FileChange} from 'shared'
import {
    getAttemptGitStatus,
    getAttemptFileContent,
    commitAttempt,
    pushAttempt,
    createProjectPullRequest,
    listProjectPullRequests,
    summarizeProjectPullRequest,
} from '@/api/git'
import {SERVER_URL} from '@/lib/env'

const gitKey = (attemptId: string, suffix: string) => ['attempt-git', attemptId, suffix] as const

export function useAttemptGitStatus(
    attemptId: string | undefined,
    options?: Partial<UseQueryOptions<{ files: FileChange[] }>>,
) {
    const enabled = Boolean(attemptId)
    return useQuery({
        queryKey: attemptId ? gitKey(attemptId, 'status') : ['attempt-git', 'disabled'],
        queryFn: () => getAttemptGitStatus(attemptId!),
        enabled,
        ...options,
    })
}

export function useAttemptFileContent(
    attemptId: string | undefined,
    path: string | undefined,
    source: 'worktree' | 'index' | 'head' | 'base',
    options?: Partial<UseQueryOptions<string | null>>,
) {
    const enabled = Boolean(attemptId && path)
    return useQuery({
        queryKey: attemptId && path ? ['attempt-git', attemptId, 'file', path, source] : ['attempt-git', 'file', 'disabled'],
        queryFn: () => getAttemptFileContent(attemptId!, path!, source),
        enabled,
        ...options,
    })
}

type CommitArgs = { attemptId: string; subject: string; body?: string | null; pushAfter?: boolean }

type CommitResult = { shortSha: string }

export function useCommitAttempt(options?: UseMutationOptions<CommitResult, Error, CommitArgs>) {
    return useMutation({
        mutationFn: async ({attemptId, subject, body, pushAfter}: CommitArgs) => {
            const result = await commitAttempt(attemptId, subject, body || undefined)
            if (pushAfter) {
                await pushAttempt(attemptId, true)
            }
            return result
        },
        ...options,
    })
}

type CreatePrArgs = {
    projectId: string
    attemptId?: string
    cardId?: string
    base?: string
    branch?: string
    title: string
    body?: string
}

export function useCreatePullRequest(options?: UseMutationOptions<PRInfo, Error, CreatePrArgs>) {
    return useMutation({
        mutationFn: ({projectId, ...payload}: CreatePrArgs) =>
            createProjectPullRequest(projectId, {...payload, draft: false}),
        ...options,
    })
}

type PrSummaryArgs = {
    projectId: string
    base?: string
    branch?: string
    agent?: string
    profileId?: string
}

type PrSummaryResult = {title: string; body: string}

export function useSummarizePullRequest(
    options?: UseMutationOptions<PrSummaryResult, Error, PrSummaryArgs>,
) {
    return useMutation({
        mutationFn: ({projectId, ...payload}: PrSummaryArgs) =>
            summarizeProjectPullRequest(projectId, payload),
        ...options,
    })
}

export function useProjectPullRequests(
    projectId: string | undefined,
    params?: {branch?: string; state?: 'open' | 'closed' | 'all'},
    options?: Partial<UseQueryOptions<PRInfo[]>>,
) {
    const enabled = Boolean(projectId)
    const branchKey = params?.branch?.trim() || 'all'
    const stateKey = params?.state ?? 'open'
    const key = projectId
        ? ['project', projectId, 'pull-requests', branchKey, stateKey]
        : ['project', 'pull-requests', 'disabled']
    return useQuery({
        queryKey: key,
        queryFn: () => listProjectPullRequests(projectId!, {...params, branch: params?.branch?.trim() || undefined}),
        enabled,
        ...options,
    })
}

async function mergeAttemptBase(attemptId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/attempts/${attemptId}/git/merge`, {method: 'POST'})
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Merge failed')
    }
}

type MergeArgs = { attemptId: string }

export function useMergeAttemptBase(options?: UseMutationOptions<void, Error, MergeArgs>) {
    return useMutation({
        mutationFn: ({attemptId}: MergeArgs) => mergeAttemptBase(attemptId),
        ...options,
    })
}
