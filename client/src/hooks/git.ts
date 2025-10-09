import {useQuery, type UseQueryOptions} from '@tanstack/react-query'
import {useMutation, type UseMutationOptions} from '@tanstack/react-query'
import type {GitFileStatus, PRInfo} from 'shared'
import {getAttemptGitStatus, getAttemptFileContent, commitAttempt, pushAttempt, createAttemptPR} from '@/api/git'
import {SERVER_URL} from '@/lib/env'

const gitKey = (attemptId: string, suffix: string) => ['attempt-git', attemptId, suffix] as const

export function useAttemptGitStatus(
    attemptId: string | undefined,
    options?: Partial<UseQueryOptions<{ files: Array<{ path: string; status: GitFileStatus }> }>>,
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

type CreatePrArgs = { attemptId: string; base?: string; title: string; body?: string }

export function useCreateAttemptPR(options?: UseMutationOptions<PRInfo, Error, CreatePrArgs>) {
    return useMutation({
        mutationFn: ({attemptId, base, title, body}: CreatePrArgs) =>
            createAttemptPR(attemptId, {base, title, body, draft: false}),
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
