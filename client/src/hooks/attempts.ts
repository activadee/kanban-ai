import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {
    Attempt,
    AttemptLog,
    ConversationAutomationItem,
    ConversationItem,
    AttemptTodoSummary,
} from 'shared'
import {attemptKeys, cardAttemptKeys} from '@/lib/queryClient'
import {
    followupAttemptRequest,
    getAttempt,
    getAttemptDetailForCard,
    getAttemptLogs,
    openAttemptEditor,
    startAttemptRequest,
    stopAttemptRequest,
    runDevAutomationRequest,
} from '@/api/attempts'

type CardAttemptResult = {
    attempt: Attempt;
    logs: AttemptLog[];
    conversation: ConversationItem[];
    todos?: AttemptTodoSummary | null;
}

type CardAttemptOptions = Partial<UseQueryOptions<CardAttemptResult>>

export function useCardAttempt(projectId: string | undefined, cardId: string | undefined, options?: CardAttemptOptions) {
    const enabled = Boolean(projectId && cardId)
    const key = enabled ? cardAttemptKeys.detail(projectId!, cardId!) : (['card-attempt', 'disabled'] as const)
    return useQuery({
        queryKey: key,
        queryFn: () => getAttemptDetailForCard(projectId!, cardId!),
        enabled,
        ...options,
    })
}

type AttemptOptions = Partial<UseQueryOptions<Attempt>>

export function useAttempt(attemptId: string | undefined, options?: AttemptOptions) {
    const enabled = Boolean(attemptId)
    const key = enabled ? attemptKeys.detail(attemptId!) : (['attempt', 'disabled'] as const)
    return useQuery({
        queryKey: key,
        queryFn: () => getAttempt(attemptId!),
        enabled,
        ...options,
    })
}

type AttemptLogsOptions = Partial<UseQueryOptions<AttemptLog[]>>

export function useAttemptLogs(attemptId: string | undefined, options?: AttemptLogsOptions) {
    const enabled = Boolean(attemptId)
    const key = enabled ? attemptKeys.logs(attemptId!) : (['attempt-logs', 'disabled'] as const)
    return useQuery({
        queryKey: key,
        queryFn: () => getAttemptLogs(attemptId!),
        enabled,
        ...options,
    })
}

type StartAttemptArgs = {
    projectId: string;
    cardId: string;
    agent: string;
    profileId?: string;
    baseBranch?: string;
    branchName?: string
}

type StartAttemptOptions = UseMutationOptions<Attempt, Error, StartAttemptArgs>

export function useStartAttempt(options?: StartAttemptOptions) {
    return useMutation({
        mutationFn: (args: StartAttemptArgs) =>
            startAttemptRequest({
                projectId: args.projectId,
                cardId: args.cardId,
                agent: args.agent,
                profileId: args.profileId,
                baseBranch: args.baseBranch,
                branchName: args.branchName,
            }),
        ...options,
    })
}

type FollowupAttemptArgs = { attemptId: string; prompt: string; profileId?: string }

type FollowupAttemptOptions = UseMutationOptions<void, Error, FollowupAttemptArgs>

export function useFollowupAttempt(options?: FollowupAttemptOptions) {
    return useMutation({
        mutationFn: ({attemptId, prompt, profileId}: FollowupAttemptArgs) =>
            followupAttemptRequest(attemptId, {prompt, profileId}),
        ...options,
    })
}

type StopAttemptOptions = UseMutationOptions<void, Error, { attemptId: string }>

export function useStopAttempt(options?: StopAttemptOptions) {
    return useMutation({
        mutationFn: ({attemptId}: { attemptId: string }) => stopAttemptRequest(attemptId),
        ...options,
    })
}

type OpenEditorArgs = { attemptId: string; subpath?: string; editorKey?: string }

type OpenEditorResult = { ok: true; command: { cmd: string; args: string[] } }

type OpenEditorOptions = UseMutationOptions<OpenEditorResult, Error, OpenEditorArgs>

export function useOpenAttemptEditor(options?: OpenEditorOptions) {
    return useMutation({
        mutationFn: ({attemptId, subpath, editorKey}: OpenEditorArgs) =>
            openAttemptEditor(attemptId, {subpath, editorKey}),
        ...options,
    })
}

type RunDevAutomationOptions = UseMutationOptions<ConversationAutomationItem, Error, { attemptId: string }>

export function useRunDevAutomation(options?: RunDevAutomationOptions) {
    return useMutation({
        mutationFn: ({attemptId}: { attemptId: string }) => runDevAutomationRequest(attemptId),
        ...options,
    })
}
