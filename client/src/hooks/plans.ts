import {useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {CardPlan, SavePlanInput} from 'shared'
import {planKeys} from '@/lib/queryClient'
import {deletePlan, fetchPlan, savePlan} from '@/api/plans'

type PlanOptions = Partial<UseQueryOptions<CardPlan | null>>

export function usePlan(projectId: string | undefined, cardId: string | undefined, options?: PlanOptions) {
    const enabled = Boolean(projectId && cardId)
    const key = enabled ? planKeys.card(projectId!, cardId!) : (['plan', 'disabled'] as const)
    return useQuery({
        queryKey: key,
        queryFn: () => fetchPlan(projectId!, cardId!),
        enabled,
        ...options,
    })
}

type SavePlanArgs = {projectId: string; cardId: string; input: SavePlanInput}

type SavePlanOptions = UseMutationOptions<CardPlan, Error, SavePlanArgs>

export function useSavePlan(options?: SavePlanOptions) {
    const queryClient = useQueryClient()
    const userOnSuccess = options?.onSuccess
    return useMutation({
        mutationFn: ({projectId, cardId, input}: SavePlanArgs) => savePlan(projectId, cardId, input),
        ...options,
        onSuccess: async (plan, variables, onMutateResult, context) => {
            queryClient.setQueryData(planKeys.card(variables.projectId, variables.cardId), plan)
            await userOnSuccess?.(plan, variables, onMutateResult, context)
        },
    })
}

type DeletePlanArgs = {projectId: string; cardId: string}

type DeletePlanOptions = UseMutationOptions<void, Error, DeletePlanArgs>

export function useDeletePlan(options?: DeletePlanOptions) {
    const queryClient = useQueryClient()
    const userOnSuccess = options?.onSuccess
    return useMutation({
        mutationFn: ({projectId, cardId}: DeletePlanArgs) => deletePlan(projectId, cardId),
        ...options,
        onSuccess: async (_res, variables, onMutateResult, context) => {
            queryClient.setQueryData(planKeys.card(variables.projectId, variables.cardId), null)
            await userOnSuccess?.(_res, variables, onMutateResult, context)
        },
    })
}
