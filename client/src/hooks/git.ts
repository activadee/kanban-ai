import {useQuery, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
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

export const prInlineSummaryKeys = {
    all: ['pr-inline-summary'] as const,
    detail: (
        projectId: string,
        headBranch: string,
        baseBranch?: string,
        cardId?: string,
        attemptId?: string,
    ) =>
        [
            ...prInlineSummaryKeys.all,
            projectId,
            headBranch,
            baseBranch ?? '__auto__',
            cardId?.trim() || attemptId?.trim() || '__none__',
        ] as const,
    disabled: ['pr-inline-summary', 'disabled'] as const,
}

export type PrInlineSummaryError = { title?: string; description?: string; status?: number }

export type PrInlineSummaryCache = {
    status: 'idle' | 'running' | 'success' | 'error'
    summary?: PrSummaryResult
    error?: PrInlineSummaryError
    original?: { title: string; body: string }
    branch?: string
    base?: string
    requestedAt?: number
    completedAt?: number
}

const normalizeBranch = (branch?: string | null) => branch?.trim() || ''
const normalizeBase = (base?: string | null) => base?.trim() || undefined

export function usePrInlineSummaryCache(
    projectId?: string,
    branch?: string | null,
    base?: string | null,
    cardId?: string | null,
    attemptId?: string | null,
) {
    const queryClient = useQueryClient()
    const headBranch = normalizeBranch(branch)
    const baseBranch = normalizeBase(base)
    const key =
        projectId && headBranch
            ? prInlineSummaryKeys.detail(
                projectId,
                headBranch,
                baseBranch,
                cardId ?? undefined,
                attemptId ?? undefined,
            )
            : prInlineSummaryKeys.disabled
    const query = useQuery<PrInlineSummaryCache>({
        queryKey: key,
        queryFn: () =>
            queryClient.getQueryData<PrInlineSummaryCache>(key) ?? {
                status: 'idle',
                branch: headBranch,
                base: baseBranch,
            },
        enabled: Boolean(projectId && headBranch),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 30,
        initialData: () =>
            queryClient.getQueryData<PrInlineSummaryCache>(key) ?? {
                status: 'idle',
                branch: headBranch,
                base: baseBranch,
            },
    })

    return {...query, key: projectId && headBranch ? key : null}
}

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
    attemptId?: string
    cardId?: string
    agent?: string
    profileId?: string
    signal?: AbortSignal
}

type PrSummaryResult = {title: string; body: string}

export function useSummarizePullRequest(
    options?: UseMutationOptions<PrSummaryResult, Error, PrSummaryArgs>,
) {
    return useMutation({
        mutationFn: ({projectId, signal, ...payload}: PrSummaryArgs) =>
            summarizeProjectPullRequest(projectId, payload, signal),
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
