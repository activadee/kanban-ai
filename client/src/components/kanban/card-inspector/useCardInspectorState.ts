import {useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import type {
    AgentKey,
    Attempt,
    AttemptLog,
    ConversationAutomationItem,
    ConversationItem,
    Card as TCard,
    AttemptTodoSummary,
    TicketType,
} from 'shared'
import {attemptKeys, cardAttemptKeys} from '@/lib/queryClient'
import {
    useAgents,
    useAgentProfiles,
    useAppSettings,
    useEditors,
    useCardAttempt,
    useStartAttempt,
    useFollowupAttempt,
    useStopAttempt,
    useOpenAttemptEditor,
    useProjectSettings,
    useRunDevAutomation,
} from '@/hooks'
import {useAttemptEventStream} from '@/hooks/useAttemptEventStream'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'
import {eventBus} from '@/lib/events'

export type InspectorTab = 'messages' | 'processes' | 'logs'

const IMPLEMENTATION_KIND = 'implementation' as const

export type CardInspectorDetailsState = {
    values: { title: string; description: string; dependsOn: string[]; ticketType: TicketType | null }
    setValues: Dispatch<SetStateAction<{ title: string; description: string; dependsOn: string[]; ticketType: TicketType | null }>>
    saving: boolean
    deleting: boolean
    handleSave: () => Promise<void>
    handleDelete: () => Promise<void>
}

export type CardInspectorHeaderState = {
    copied: boolean
    handleCopyTicketKey: () => Promise<void>
}

export type CardInspectorAttemptState = {
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
    startAttempt: (opts?: {isPlanningAttempt?: boolean}) => Promise<void>
    retryAttempt: () => Promise<void>
    starting: boolean
    retrying: boolean
    stopAttempt: () => Promise<void>
    stopping: boolean
    handleAgentSelect: (value: AgentKey) => void
    handleProfileSelect: (value: string) => void
}

export type CardInspectorGitState = {
    openButtonDisabledReason: string | null
    handleOpenEditor: () => Promise<void>
    changesOpen: boolean
    setChangesOpen: (open: boolean) => void
    commitOpen: boolean
    setCommitOpen: (open: boolean) => void
    prOpen: boolean
    setPrOpen: (open: boolean) => void
    mergeOpen: boolean
    setMergeOpen: (open: boolean) => void
    prDefaults: { title: string; body: string }
    todoSummary: AttemptTodoSummary | null
}

export type CardInspectorActivityState = {
    devScriptConfigured: boolean
    latestDevAutomation: ConversationAutomationItem | null
    devAutomationPending: boolean
    runDevScript: () => void
}

export type UseCardInspectorStateArgs = {
    projectId: string
    card: TCard
    locked?: boolean
    blocked?: boolean
    availableCards?: { id: string; title: string; ticketKey?: string }[]
    cardsIndex?: Map<string, { id: string; title: string; ticketKey?: string }>
    onUpdate: (values: { title: string; description: string; dependsOn?: string[]; ticketType?: TicketType | null }) => Promise<void> | void
    onDelete: () => Promise<void> | void
}

export type UseCardInspectorStateResult = {
    details: CardInspectorDetailsState
    header: CardInspectorHeaderState
    attempt: CardInspectorAttemptState
    git: CardInspectorGitState
    activity: CardInspectorActivityState
}

export function useCardInspectorState({
                                          projectId,
                                          card,
                                          onUpdate,
                                          onDelete,
                                      }: UseCardInspectorStateArgs): UseCardInspectorStateResult {
    const queryClient = useQueryClient()

    const [values, setValues] = useState({
        title: card.title,
        description: card.description ?? '',
        dependsOn: (card.dependsOn ?? []) as string[],
        ticketType: card.ticketType ?? null,
    })
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [agent, setAgent] = useState<AgentKey>('')
    const [starting, setStarting] = useState(false)
    const [attempt, setAttempt] = useState<Attempt | null>(null)
    const [logs, setLogs] = useState<AttemptLog[]>([])
    const [conversation, setConversation] = useState<ConversationItem[]>([])
    const [followup, setFollowup] = useState('')
    const [todoSummary, setTodoSummary] = useState<AttemptTodoSummary | null>(null)

    const attemptAgent = attempt?.agent ? (attempt.agent as AgentKey) : undefined
    const manualAgentRef = useRef(false)
    const manualProfilesByAgentRef = useRef<Record<string, string | null>>({})

    const followupMutation = useFollowupAttempt({
        onSuccess: async (_res, vars) => {
            setFollowup('')
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(vars.attemptId)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(vars.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND)})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Follow-up failed')
            toast({title, description, variant: 'destructive'})
        },
    })

    const devAutomationMutation = useRunDevAutomation({
        onSuccess: async (_item, variables) => {
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(variables.attemptId)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(variables.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND)})
            toast({title: 'Dev script completed', description: 'Check the automation log for output.'})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Dev script failed')
            toast({title, description, variant: 'destructive'})
        },
    })

    const [stopping, setStopping] = useState(false)
    const [profileId, setProfileId] = useState<string | undefined>(undefined)
    const [changesOpen, setChangesOpen] = useState(false)
    const [commitOpen, setCommitOpen] = useState(false)
    const [prOpen, setPrOpen] = useState(false)
    const [mergeOpen, setMergeOpen] = useState(false)
    const [copied, setCopied] = useState(false)

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

    const devScriptConfigured = useMemo(() => {
        const raw = projectSettingsQuery.data?.devScript
        if (typeof raw !== 'string') return false
        return raw.trim().length > 0
    }, [projectSettingsQuery.data?.devScript])

    const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data])

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

    const appSettingsQuery = useAppSettings()
    const editorsQuery = useEditors()

    const installedEditors = useMemo(
        () => (editorsQuery.data ?? []).filter((editor) => editor.installed),
        [editorsQuery.data],
    )

    const defaultEditorKey = appSettingsQuery.data?.editorType ?? ''

    const defaultEditor = useMemo(
        () => installedEditors.find((editor) => editor.key === defaultEditorKey),
        [installedEditors, defaultEditorKey],
    )

    const openButtonDisabledReason = useMemo(() => {
        if (!defaultEditor) return 'Set a default editor in App Settings.'
        if (!attempt) return null
        if (!attempt.worktreePath) {
            return 'This attempt\'s worktree has been cleaned up. Start a new attempt to open an editor.'
        }
        return null
    }, [defaultEditor, attempt])

    const prDefaults = useMemo(() => {
        const settings = appSettingsQuery.data
        const autolink = settings?.ghAutolinkTickets ?? true
        const titleTmpl = settings?.ghPrTitleTemplate || (autolink ? '[{ticketKey}] {title}' : '{title}')
        const bodyTmpl = settings?.ghPrBodyTemplate || ''
        const tokens: Record<string, string> = {
            ticketKey: card.ticketKey ?? '',
            title: values.title,
            branch: attempt?.branchName ?? '',
            attemptId: attempt?.id ?? '',
        }
        const render = (tmpl: string) => tmpl.replace(/\{(\w+)\}/g, (_: string, k: string) => tokens[k] ?? '')
        return {
            title: render(titleTmpl).trim(),
            body: render(bodyTmpl).trim(),
        }
    }, [appSettingsQuery.data, card.ticketKey, values.title, attempt?.branchName, attempt?.id])

    const attemptDetailQuery = useCardAttempt(projectId, card.id)

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
        setValues({
            title: card.title,
            description: card.description ?? '',
            dependsOn: (card.dependsOn ?? []) as string[],
            ticketType: card.ticketType ?? null,
        })

        if (attemptDetailQuery.data) {
            setAttempt(attemptDetailQuery.data.attempt)
            setLogs(attemptDetailQuery.data.logs ?? [])
            setConversation(attemptDetailQuery.data.conversation ?? [])
            setTodoSummary(attemptDetailQuery.data.todos ?? null)
        } else {
            setAttempt(null)
            setLogs([])
            setConversation([])
            setTodoSummary(null)
        }
    }, [card.id, card.title, card.description, card.dependsOn, card.ticketType, attemptDetailQuery.data])

    useEffect(() => {
        manualAgentRef.current = false
        manualProfilesByAgentRef.current = {}
        setProfileId(undefined)
    }, [card.id])

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

    useEffect(() => {
        const off = eventBus.on('attempt_started', (payload) => {
            if (payload.cardId !== card.id) return
            queryClient.invalidateQueries({
                queryKey: cardAttemptKeys.card(projectId, card.id),
            })
        })
        return off
    }, [card.id, projectId, queryClient])

    useAttemptEventStream({
        attemptId: attempt?.id,
        onStatus: (status) => {
            setAttempt((prev) => (prev ? ({...prev, status} as Attempt) : prev))
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND),
                (prev:
                     | {
                attempt: Attempt
                logs: AttemptLog[]
                conversation: ConversationItem[]
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
                cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND),
                (prev:
                     | {
                attempt: Attempt
                logs: AttemptLog[]
                conversation: ConversationItem[]
            }
                     | undefined) => {
                    if (!prev) return prev
                    return {...prev, logs: [...prev.logs, entry]}
                },
            )
        },
        onMessage: (item) => {
            setConversation((prev) => {
                if (item.id && prev.some((m) => m.id === item.id)) return prev
                return [...prev, item]
            })
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND),
                (prev:
                     | {
                attempt: Attempt
                logs: AttemptLog[]
                conversation: ConversationItem[]
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
                cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND),
                (prev:
                     | {
                attempt: Attempt
                logs: AttemptLog[]
                conversation: ConversationItem[]
            }
                     | undefined) => {
                    if (!prev) return prev
                    return {...prev, attempt: {...prev.attempt, sessionId}}
                },
            )
        },
        onTodos: (summary) => {
            setTodoSummary(summary)
            queryClient.setQueryData(
                cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND),
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

    const handleSave = async () => {
        if (!values.title.trim()) return
        try {
            setSaving(true)
            await onUpdate({
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn,
                ticketType: values.ticketType ?? null,
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this ticket?')) return
        try {
            setDeleting(true)
            await onDelete()
        } finally {
            setDeleting(false)
        }
    }

    const startMutation = useStartAttempt({
        onSuccess: async (att) => {
            setAttempt(att)
            setConversation([])
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(att.id)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(att.id)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND)})
        },
    })

    const startAttempt = async (opts?: {isPlanningAttempt?: boolean}) => {
        if (!projectId) return
        setStarting(true)
        try {
            await startMutation.mutateAsync({
                projectId,
                cardId: card.id,
                agent,
                profileId,
                isPlanningAttempt: opts?.isPlanningAttempt === true,
            })
        } catch (err) {
            console.error('Start attempt failed', err)
        } finally {
            setStarting(false)
        }
    }

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
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id, IMPLEMENTATION_KIND)})
        },
    })

    const openEditorMutation = useOpenAttemptEditor()

    const handleOpenEditor = async () => {
        if (!attempt || openButtonDisabledReason) return
        try {
            const res = await openEditorMutation.mutateAsync({attemptId: attempt.id})
            const title = defaultEditor ? `Opening in ${defaultEditor.label}` : 'Opening editor'
            toast({title, description: `${res.command.cmd} ${res.command.args.join(' ')}`})
        } catch (err: unknown) {
            const {description, title} = describeApiError(err, 'Open failed')
            toast({title, description, variant: 'destructive'})
        }
    }

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

    const handleCopyTicketKey = async () => {
        if (!card.ticketKey) return
        try {
            await navigator.clipboard.writeText(card.ticketKey)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch (err) {
            console.warn('clipboard copy failed', err)
        }
    }

    const handleRunDevScript = () => {
        if (!devScriptConfigured) {
            toast({title: 'Dev script not configured', description: 'Add a dev script in Project Settings.'})
            return
        }
        if (!attempt) {
            toast({
                title: 'Worktree missing',
                description: 'Start an attempt to run the dev script.',
                variant: 'destructive',
            })
            return
        }
        devAutomationMutation.mutate({attemptId: attempt.id})
    }

    const latestDevAutomation = useMemo<ConversationAutomationItem | null>(() => {
        for (let i = conversation.length - 1; i >= 0; i--) {
            const item = conversation[i]
            if (item.type === 'automation' && item.stage === 'dev') return item
        }
        return null
    }, [conversation])

    return {
        details: {
            values,
            setValues,
            saving,
            deleting,
            handleSave,
            handleDelete,
        },
        header: {
            copied,
            handleCopyTicketKey,
        },
        attempt: {
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
            retryAttempt: startAttempt, // Retry uses the same logic as start attempt
            retrying: starting, // Use starting state for retrying as well
            stopAttempt,
            stopping,
            handleAgentSelect,
            handleProfileSelect,
        },
        git: {
            openButtonDisabledReason,
            handleOpenEditor,
            changesOpen,
            setChangesOpen,
            commitOpen,
            setCommitOpen,
            prOpen,
            setPrOpen,
            mergeOpen,
            setMergeOpen,
            prDefaults,
            todoSummary,
        },
        activity: {
            devScriptConfigured,
            latestDevAutomation,
            devAutomationPending: devAutomationMutation.isPending,
            runDevScript: handleRunDevScript,
        },
    }
}
