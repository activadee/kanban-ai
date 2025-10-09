import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {AgentProfileRow, AgentProfileSchemaResponse, AgentsListResponse} from 'shared'
import {
    createAgentProfileRequest,
    deleteAgentProfileRequest,
    getAgentSchema,
    listAgentProfiles,
    listAgents,
    updateAgentProfileRequest,
} from '@/api/agents'
import {agentKeys} from '@/lib/queryClient'

export function useAgents(options?: Partial<UseQueryOptions<AgentsListResponse>>) {
    return useQuery({
        queryKey: agentKeys.list(),
        queryFn: listAgents,
        ...options,
    })
}

export function useAgentProfiles(scope: string, options?: Partial<UseQueryOptions<AgentProfileRow[]>>) {
    return useQuery({
        queryKey: agentKeys.profiles(scope),
        queryFn: () => listAgentProfiles(),
        ...options,
    })
}

export function useAgentSchema(agentKey: string | undefined, options?: Partial<UseQueryOptions<AgentProfileSchemaResponse>>) {
    return useQuery({
        queryKey: ['agent-schema', agentKey ?? ''],
        queryFn: () => getAgentSchema(agentKey ?? ''),
        enabled: Boolean(agentKey),
        ...options,
    })
}

type CreatePayload = { agent: string; name: string; config: unknown }

type UpdatePayload = { profileId: string; payload: { name?: string; config?: unknown } }

type DeleteArgs = { profileId: string }

export function useCreateAgentProfile(options?: UseMutationOptions<AgentProfileRow, Error, CreatePayload>) {
    return useMutation({
        mutationFn: (variables: CreatePayload) => createAgentProfileRequest(variables),
        ...options,
    })
}

export function useUpdateAgentProfile(options?: UseMutationOptions<AgentProfileRow, Error, UpdatePayload>) {
    return useMutation({
        mutationFn: ({profileId, payload}) => updateAgentProfileRequest(profileId, payload),
        ...options,
    })
}

export function useDeleteAgentProfile(options?: UseMutationOptions<void, Error, DeleteArgs>) {
    return useMutation({
        mutationFn: ({profileId}: DeleteArgs) => deleteAgentProfileRequest(profileId),
        ...options,
    })
}
