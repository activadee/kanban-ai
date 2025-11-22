import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {
    GitHubCheckResponse,
    GitHubDevicePollResponse,
    GitHubDeviceStartResponse,
    GithubAppConfig,
    UpsertGithubAppConfigRequest,
} from 'shared'
import {
    checkGitHubDevice,
    getGithubAppConfig,
    logoutGitHub,
    pollGitHubDevice,
    putGithubAppConfig,
    startGitHubDevice,
} from '@/api/github'
import {githubKeys} from '@/lib/queryClient'

type AuthOptions = Partial<UseQueryOptions<GitHubCheckResponse>>

export function useGithubAuthStatus(options?: AuthOptions) {
    return useQuery({
        queryKey: githubKeys.check(),
        queryFn: checkGitHubDevice,
        ...options,
    })
}

type StartOptions = UseMutationOptions<GitHubDeviceStartResponse, Error, void>

type PollOptions = UseMutationOptions<GitHubDevicePollResponse, Error, void>

type LogoutOptions = UseMutationOptions<void, Error, void>

export function useStartGithubDevice(options?: StartOptions) {
    return useMutation({
        mutationFn: startGitHubDevice,
        ...options,
    })
}

export function usePollGithubDevice(options?: PollOptions) {
    return useMutation({
        mutationFn: pollGitHubDevice,
        ...options,
    })
}

export function useLogoutGithub(options?: LogoutOptions) {
    return useMutation({
        mutationFn: logoutGitHub,
        ...options,
    })
}

type AppConfigOptions = Partial<UseQueryOptions<GithubAppConfig>>
export function useGithubAppConfig(options?: AppConfigOptions) {
    return useQuery({
        queryKey: githubKeys.appConfig(),
        queryFn: getGithubAppConfig,
        ...options,
    })
}

type SaveAppConfigOptions = UseMutationOptions<GithubAppConfig, Error, UpsertGithubAppConfigRequest>
export function useSaveGithubAppConfig(options?: SaveAppConfigOptions) {
    return useMutation({
        mutationFn: (payload: UpsertGithubAppConfigRequest) => putGithubAppConfig(payload),
        ...options,
    })
}
