import {useMutation, type UseMutationOptions} from '@tanstack/react-query'
import type {GitRepositoryEntry} from 'shared'
import {discoverGitRepositories} from '@/api/filesystem'

type DiscoverArgs = { path?: string }

type DiscoverResult = GitRepositoryEntry[]

type DiscoverContext = void

export function useDiscoverGitRepositories(
    options?: UseMutationOptions<DiscoverResult, Error, DiscoverArgs, DiscoverContext>,
) {
    return useMutation({
        mutationFn: ({path}: DiscoverArgs = {}) => discoverGitRepositories(path),
        ...options,
    })
}
