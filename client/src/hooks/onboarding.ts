import {useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {OnboardingStatus} from 'shared'
import {completeOnboarding, getOnboardingStatus, recordOnboardingProgress} from '@/api/onboarding'
import {onboardingKeys} from '@/lib/queryClient'

type StatusOptions = Partial<UseQueryOptions<OnboardingStatus>>

export function useOnboardingStatus(options?: StatusOptions) {
    return useQuery({
        queryKey: onboardingKeys.status(),
        queryFn: getOnboardingStatus,
        ...options,
    })
}

type ProgressOptions = UseMutationOptions<OnboardingStatus, Error, { step?: string }, unknown>

export function useOnboardingProgress(options?: ProgressOptions) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: { step?: string }) => recordOnboardingProgress(payload?.step),
        onSuccess: (status, variables, onMutateResult, context) => {
            const ctx = (context ?? onMutateResult) as unknown
            queryClient.setQueryData(onboardingKeys.status(), status)
            options?.onSuccess?.(status, variables, onMutateResult, ctx as any)
        },
        ...options,
    })
}

type CompleteOptions = UseMutationOptions<OnboardingStatus, Error, { step?: string }, unknown>

export function useCompleteOnboarding(options?: CompleteOptions) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: { step?: string }) => completeOnboarding(payload?.step),
        onSuccess: (status, variables, onMutateResult, context) => {
            const ctx = (context ?? onMutateResult) as unknown
            queryClient.setQueryData(onboardingKeys.status(), status)
            options?.onSuccess?.(status, variables, onMutateResult, ctx as any)
        },
        ...options,
    })
}
