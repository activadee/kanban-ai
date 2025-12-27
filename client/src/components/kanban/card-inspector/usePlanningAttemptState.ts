import {useEffect, useMemo, useRef, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import type {
    AgentKey,
    Attempt,
    AttemptLog,
    ConversationItem,
    AttemptTodoSummary,
} from 'shared'
import {attemptKeys, cardAttemptKeys} from '@/lib/queryClient'
import {
    useAgents,
    useAgentProfiles,
    useCardAttempt,
    useFollowupAttempt,
    useProjectSettings,
    useStartAttempt,
    useStopAttempt,
} from '@/hooks'
import {useAttemptEventStream} from '@/hooks/useAttemptEventStream'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'

export type PlanningAttemptTab = 'messages' | 'logs'

export type PlanningAttemptState = {
    attempt: Attempt | null
    logs: AttemptLog[]
    conversation: ConversationItem[]
    agent: AgentKey
    agents: Array<{ key: AgentKey; label: string }>
    availableProfiles: Array<{ id: string; name: string }>
    profileId?: string
    attemptAgent?: AgentKey
    followupProfiles: Array<{ id: string; name: string }>
    followup: string
    setFollowup: (value: string) => void
    sendFollowup: () => Promise<void>
    sendFollowupPending: boolean
    startAttempt: () => Promise<void>
    retryAttempt: () => Promise<void>
    starting: boolean
    retrying: boolean
    stopAttempt: () => Promise<void>
    stopping: boolean
    handleAgentSelect: (value: AgentKey) => void
    handleProfileSelect: (value: string) => void
}

const PLANNING_KIND = 'planning' as const

export function usePlanningAttemptState({
    projectId,
    cardId,
}: {
    projectId: string
    cardId: string
}): PlanningAttemptState {
    const queryClient = useQueryClient()

    const [agent, setAgent] = useState<AgentKey>('')
    const [starting, setStarting] = useState(false)
    const [attempt, setAttempt] = useState<Attempt | null>(null)
    const [logs, setLogs] = useState<AttemptLog[]>([])
    const [conversation, setConversation] = useState<ConversationItem[]>([])
    const [followup, setFollowup] = useState('')

    const attemptAgent = attempt?.agent ? (attempt.agent as AgentKey) : undefined
    const manualAgentRef = useRef(false)
    const manualProfilesByAgentRef = useRef<Record<string, string | null>>({})

    const [stopping, setStopping] = useState(false)
    const [profileId, setProfileId] = useState<string | undefined>(undefined)

    const profilesQuery = useAgentProfiles('global')
    const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data])
    const profilesById = useMemo(() => {
        const map = new Map<string, (typeof profiles)[number]>()
        for (const profile of profiles) map.set(profile.id, profile)
        return map
    }, [profiles])

    const availableProfiles = useMemo(
        () =>
            profiles
                .filter((profile) => (agent ? profile.agent === agent : false))
                .map((profile) => ({
                    id: profile.id,
                    name: profile.name,
                })),
        [profiles, agent],
    )

    const agentsQuery = useAgents()
    const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data])
    const projectSettingsQuery = useProjectSettings(projectId)

    const projectDefaultProfileId = useMemo(() => {
        const raw = projectSettingsQuery.data?.defaultProfileId
        if (typeof raw !== 'string') return undefined
        const trimmed = raw.trim()
        return trimmed.length ? trimmed : undefined
    }, [projectSettingsQuery.data?.defaultProfileId])

    const projectDefaultAgent = useMemo(() => {
        const raw = projectSettingsQuery.data?.defaultAgent
        if (typeof raw !== 'string') return undefined
        const trimmed = raw.trim()
        return trimmed.length ? (trimmed as AgentKey) : undefined
    }, [projectSettingsQuery.data?.defaultAgent])

    useEffect(() => {
        if (!agents.length) return

        const lookupHas = (key: AgentKey | undefined) => (key ? agents.some((a) => a.key === key) : false)

        if (attemptAgent && lookupHas(attemptAgent)) {
            if (agent !== attemptAgent) {
                manualAgentRef.current = false
                setAgent(attemptAgent)
            }
            return
        }

        if (manualAgentRef.current) return

        let candidate: AgentKey | undefined

        if (projectDefaultAgent && lookupHas(projectDefaultAgent)) {
            candidate = projectDefaultAgent
        }

        if (!candidate) {
            if (agent && lookupHas(agent)) {
                candidate = agent
            } else {
                candidate = agents[0]?.key
            }
        }

        if (candidate && agent !== candidate) {
            setAgent(candidate)
        }
    }, [agent, agents, attemptAgent, projectDefaultAgent])

    const attemptDetailQuery = useCardAttempt(projectId, cardId, {kind: PLANNING_KIND})

    const lastUsedProfileId = useMemo(() => {
        const items = attemptDetailQuery.data?.conversation ?? []
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i]
            if (item.type === 'message') {
                const candidate = typeof item.profileId === 'string' ? item.profileId.trim() : ''
                if (candidate) return candidate
            }
        }
        return undefined
    }, [attemptDetailQuery.data?.conversation])

    useEffect(() => {
        if (attemptDetailQuery.data) {
            setAttempt(attemptDetailQuery.data.attempt)
            setLogs(attemptDetailQuery.data.logs ?? [])
            setConversation(attemptDetailQuery.data.conversation ?? [])
        } else {
            setAttempt(null)
            setLogs([])
            setConversation([])
        }
    }, [attemptDetailQuery.data, cardId])

    useEffect(() => {
        manualAgentRef.current = false
        manualProfilesByAgentRef.current = {}
        setProfileId(undefined)
    }, [cardId])

    useEffect(() => {
        if (!agent) return

        const manualMap = manualProfilesByAgentRef.current
        if (Object.prototype.hasOwnProperty.call(manualMap, agent)) {
            const stored = manualMap[agent]
            const storedProfileId = stored === null ? undefined : stored
            if ((storedProfileId ?? undefined) !== (profileId ?? undefined)) {
                setProfileId(storedProfileId)
            }
            return
        }

        let candidate: string | undefined

        if (attemptAgent && attemptAgent === agent && lastUsedProfileId) {
            const lastProfile = profilesById.get(lastUsedProfileId)
            if (!lastProfile || lastProfile.agent === agent) {
                candidate = lastUsedProfileId
            }
        }

        if (!candidate && projectSettingsQuery.isFetched && projectDefaultProfileId) {
            const defaultProfile = profilesById.get(projectDefaultProfileId)
            if (!defaultProfile || defaultProfile.agent === agent) {
                candidate = projectDefaultProfileId
            }
        }

        if ((candidate ?? undefined) !== (profileId ?? undefined)) {
            setProfileId(candidate)
        }
    }, [
        agent,
        attemptAgent,
        lastUsedProfileId,
        profileId,
        projectDefaultProfileId,
        profilesById,
        projectSettingsQuery.isFetched,
    ])

    const handleProfileSelect = (value: string) => {
        const selected = value === '__default__' ? undefined : value
        if (agent) manualProfilesByAgentRef.current[agent] = selected ?? null
        setProfileId(selected)
    }

    const handleAgentSelect = (value: AgentKey) => {
        manualAgentRef.current = true
        setAgent(value)
    }

    useAttemptEventStream({
        attemptId: attempt?.id,
        onStatus: (status) => {
            setAttempt((prev) => (prev ? ({...prev, status} as Attempt) : prev))
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND),
                (prev:
                     | {
                    attempt: Attempt
                    logs: AttemptLog[]
                    conversation: ConversationItem[]
                    todos?: AttemptTodoSummary | null
                }
                     | undefined) => {
                    if (!prev) return prev
                    return {...prev, attempt: {...prev.attempt, status}}
                },
            )
        },
        onLog: (payload) => {
            const id = attempt?.id
            if (!id) return
            const entry: AttemptLog = {
                id: crypto.randomUUID(),
                attemptId: id,
                ts: payload.ts,
                level: payload.level,
                message: payload.message,
            }
            setLogs((prev) => [...prev, entry])
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND),
                (prev:
                     | {
                    attempt: Attempt
                    logs: AttemptLog[]
                    conversation: ConversationItem[]
                    todos?: AttemptTodoSummary | null
                }
                     | undefined) => {
                    if (!prev) return prev
                    return {...prev, logs: [...(prev.logs ?? []), entry]}
                },
            )
        },
        onMessage: (item) => {
            setConversation((prev) => {
                if (item.id && prev.some((m) => m.id === item.id)) return prev
                return [...prev, item]
            })
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND),
                (prev:
                     | {
                    attempt: Attempt
                    logs: AttemptLog[]
                    conversation: ConversationItem[]
                    todos?: AttemptTodoSummary | null
                }
                     | undefined) => {
                    if (!prev) return prev
                    const items: ConversationItem[] = prev.conversation ?? []
                    if (item.id && items.some((m) => m.id === item.id)) return prev
                    return {...prev, conversation: [...items, item]}
                },
            )
        },
        onSession: (sessionId) => {
            setAttempt((prev) => (prev ? ({...prev, sessionId} as Attempt) : prev))
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND),
                (prev:
                     | {
                    attempt: Attempt
                    logs: AttemptLog[]
                    conversation: ConversationItem[]
                    todos?: AttemptTodoSummary | null
                }
                     | undefined) => {
                    if (!prev) return prev
                    return {...prev, attempt: {...prev.attempt, sessionId}}
                },
            )
        },
        onTodos: (summary) => {
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND),
                (prev:
                     | {
                    attempt: Attempt
                    logs: AttemptLog[]
                    conversation: ConversationItem[]
                    todos?: AttemptTodoSummary | null
                }
                     | undefined) => {
                    if (!prev) return prev
                    return {...prev, todos: summary}
                },
            )
        },
    })

    const startMutation = useStartAttempt({
        onSuccess: async (att) => {
            setAttempt(att)
            setConversation([])
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(att.id)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(att.id)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND)})
        },
    })

    const startAttempt = async () => {
        setStarting(true)
        try {
            await startMutation.mutateAsync({
                projectId,
                cardId,
                agent,
                profileId,
                isPlanningAttempt: true,
            })
        } catch (err: unknown) {
            const {title, description} = describeApiError(err, 'Start planning failed')
            toast({title, description, variant: 'destructive'})
        } finally {
            setStarting(false)
        }
    }

    const followupMutation = useFollowupAttempt({
        onSuccess: async (_res, vars) => {
            setFollowup('')
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(vars.attemptId)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(vars.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND)})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Follow-up failed')
            toast({title, description, variant: 'destructive'})
        },
    })

    const sendFollowup = async () => {
        if (!attempt || !attempt.sessionId || !followup.trim()) return
        try {
            await followupMutation.mutateAsync({attemptId: attempt.id, prompt: followup, profileId})
        } catch (err) {
            console.error('Follow-up failed', err)
        }
    }

    const stopMutation = useStopAttempt({
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(variables.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, cardId, PLANNING_KIND)})
        },
    })

    const stopAttempt = async () => {
        if (!attempt || attempt.status !== 'running') return
        setStopping(true)
        try {
            await stopMutation.mutateAsync({attemptId: attempt.id})
        } catch (err) {
            console.error('Stop attempt failed', err)
        } finally {
            setStopping(false)
        }
    }

    return {
        attempt,
        logs,
        conversation,
        agent,
        agents,
        availableProfiles,
        profileId,
        attemptAgent,
        followupProfiles: useMemo(
            () =>
                profiles
                    .filter((profile) => {
                        const targetAgent = attemptAgent ?? agent
                        return targetAgent ? profile.agent === targetAgent : false
                    })
                    .map((profile) => ({id: profile.id, name: profile.name})),
            [profiles, attemptAgent, agent],
        ),
        followup,
        setFollowup,
        sendFollowup,
        sendFollowupPending: followupMutation.isPending,
        startAttempt,
        starting,
        retryAttempt: startAttempt,
        retrying: starting,
        stopAttempt,
        stopping,
        handleAgentSelect,
        handleProfileSelect,
    }
}
