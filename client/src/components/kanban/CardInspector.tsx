import {useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
//
// import { cn } from '@/lib/utils'
import type {AgentKey, Attempt, AttemptLog, ConversationItem, Card as TCard} from 'shared'
import {Bot, Server} from 'lucide-react'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
//
import {AttemptChangesDialog} from '@/components/git/AttemptChangesDialog'
import {CommitDialog} from '@/components/git/CommitDialog'
import {CreatePrDialog} from '@/components/git/CreatePrDialog'
import {MergeBaseDialog} from '@/components/git/MergeBaseDialog'
// ProfilesManager modal removed; manage via Agents page
//
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
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {toast} from '@/components/ui/toast'
import {formatRelativeTime} from '@/lib/time'
import {useAttemptEventStream} from '@/hooks/useAttemptEventStream'
import {InspectorHeader} from './card-inspector/InspectorHeader'
import {CardDetailsForm} from './card-inspector/CardDetailsForm'
import {AttemptCreateForm} from './card-inspector/AttemptCreateForm'
import {AttemptToolbar} from './card-inspector/AttemptToolbar'
import {ProcessList} from './card-inspector/ProcessList'
import {MessageRow} from './card-inspector/MessageRow'
import {LogsPane} from './card-inspector/LogsPane'

//

type InspectorTab = 'messages' | 'processes' | 'logs'

type ProcessStatus = Attempt['status'] | 'idle'

type ProcessActionVariant = ComponentProps<typeof Button>['variant']

type ProcessAction = {
    id: string
    label: string
    onClick: () => void | Promise<void>
    disabled?: boolean
    variant?: ProcessActionVariant
    tooltip?: string
}

type ProcessEntry = {
    id: string
    icon: ReactNode
    name: string
    status: ProcessStatus
    description?: ReactNode
    meta?: ReactNode
    actions?: ProcessAction[]
}

// Process status labels/styles moved to './card-inspector/constants'

// formatRelativeTime imported from '@/lib/time'

export function CardInspector({
                                  projectId,
                                  boardId,
                                  card,
                                  locked = false,
                                  blocked = false,
                                  availableCards = [],
                                  cardsIndex,
                                  onUpdate,
                                  onDelete,
                                  onClose,
                              }: {
    projectId: string
    boardId: string
    card: TCard
    locked?: boolean
    blocked?: boolean
    availableCards?: { id: string; title: string; ticketKey?: string }[]
    cardsIndex?: Map<string, { id: string; title: string; ticketKey?: string }>
    onUpdate: (values: { title: string; description: string; dependsOn?: string[] }) => Promise<void> | void
    onDelete: () => Promise<void> | void
    onClose?: () => void
}) {
    const queryClient = useQueryClient()
    const [values, setValues] = useState({
        title: card.title,
        description: card.description ?? '',
        dependsOn: (card.dependsOn ?? []) as string[]
    })
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [agent, setAgent] = useState<AgentKey>('')
    const [starting, setStarting] = useState(false)
    const [attempt, setAttempt] = useState<Attempt | null>(null)
    const [logs, setLogs] = useState<AttemptLog[]>([])
    const [conversation, setConversation] = useState<ConversationItem[]>([])
    const [followup, setFollowup] = useState('')
    const [activeTab, setActiveTab] = useState<InspectorTab>('messages')
    const previousCardIdRef = useRef(card.id)
    const attemptAgent = attempt?.agent ? (attempt.agent as AgentKey) : undefined
    const manualAgentRef = useRef(false)
    const manualProfilesByAgentRef = useRef<Record<string, string | null>>({})
    const followupMutation = useFollowupAttempt({
        onSuccess: async (_res, vars) => {
            setFollowup('')
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(vars.attemptId)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(vars.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id)})
        },
        onError: (err) => {
            toast({title: 'Follow-up failed', description: err.message, variant: 'destructive'})
        },
    })
    const devAutomationMutation = useRunDevAutomation({
        onSuccess: async (_item, variables) => {
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(variables.attemptId)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(variables.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id)})
            toast({title: 'Dev script completed', description: 'Check the automation log for output.'})
        },
        onError: (err) => {
            toast({title: 'Dev script failed', description: err.message, variant: 'destructive'})
        },
    })
    const [stopping, setStopping] = useState(false)
    const [profileId, setProfileId] = useState<string | undefined>(undefined)
    const [changesOpen, setChangesOpen] = useState(false)
    const [commitOpen, setCommitOpen] = useState(false)
    const [prOpen, setPrOpen] = useState(false)
    const [mergeOpen, setMergeOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    // manage profiles moved to Project Settings / Agents
    const profilesQuery = useAgentProfiles('global')
    const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data])
    const profilesById = useMemo(() => {
        const map = new Map<string, (typeof profiles)[number]>()
        for (const profile of profiles) map.set(profile.id, profile)
        return map
    }, [profiles])
    const availableProfiles = useMemo(
        () => profiles.filter((profile) => (agent ? profile.agent === agent : false)).map((profile) => ({
            id: profile.id,
            name: profile.name
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

    // App settings for PR templates
    const appSettingsQuery = useAppSettings()
    const editorsQuery = useEditors()
    const installedEditors = useMemo(() => (editorsQuery.data ?? []).filter((editor) => editor.installed), [editorsQuery.data])
    const defaultEditorKey = appSettingsQuery.data?.editorType ?? ''
    const defaultEditor = useMemo(() => installedEditors.find((editor) => editor.key === defaultEditorKey), [installedEditors, defaultEditorKey])
    const openButtonDisabledReason = !defaultEditor ? 'Set a default editor in App Settings.' : null
    const prDefaults = useMemo(() => {
        const s = appSettingsQuery.data
        const autolink = s?.ghAutolinkTickets ?? true
        const titleTmpl = s?.ghPrTitleTemplate || (autolink ? '[{ticketKey}] {title}' : '{title}')
        const bodyTmpl = s?.ghPrBodyTemplate || ''
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
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const initialScrolledForCardRef = useRef<string | null>(null)

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

    const latestDevAutomation = useMemo(() => {
        for (let i = conversation.length - 1; i >= 0; i--) {
            const item = conversation[i]
            if (item.type === 'automation' && item.stage === 'dev') return item
        }
        return null
    }, [conversation])

    const followupProfiles = useMemo(
        () =>
            profiles
                .filter((profile) => {
                    const targetAgent = attemptAgent ?? agent
                    return targetAgent ? profile.agent === targetAgent : false
                })
                .map((profile) => ({id: profile.id, name: profile.name})),
        [profiles, attemptAgent, agent],
    )

    useEffect(() => {
        setValues({
            title: card.title,
            description: card.description ?? '',
            dependsOn: (card.dependsOn ?? []) as string[]
        })
        if (attemptDetailQuery.data) {
            setAttempt(attemptDetailQuery.data.attempt)
            setLogs(attemptDetailQuery.data.logs ?? [])
            setConversation(attemptDetailQuery.data.conversation ?? [])
        } else {
            setAttempt(null)
            setLogs([])
            setConversation([])
        }
        initialScrolledForCardRef.current = null
        if (previousCardIdRef.current !== card.id) {
            setActiveTab('messages')
        }
        previousCardIdRef.current = card.id
    }, [card.id, card.title, card.description, attemptDetailQuery.data])

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
    }, [agent, attemptAgent, lastUsedProfileId, profileId, projectDefaultProfileId, profilesById, projectSettingsQuery.isFetched])

    const handleProfileSelect = (value: string) => {
        const selected = value === '__default__' ? undefined : value
        if (agent) manualProfilesByAgentRef.current[agent] = selected ?? null
        setProfileId(selected)
    }

    const handleAgentSelect = (value: string) => {
        manualAgentRef.current = true
        setAgent(value as AgentKey)
    }

    useAttemptEventStream({
        attemptId: attempt?.id,
        onStatus: (status) => {
            setAttempt((prev) => (prev ? {...prev, status} as Attempt : prev))
            queryClient.setQueryData(cardAttemptKeys.detail(projectId, card.id), (prev: {
                attempt: Attempt;
                logs: AttemptLog[];
                conversation: ConversationItem[]
            } | undefined) => {
                if (!prev) return prev
                return {...prev, attempt: {...prev.attempt, status}}
            })
        },
        onLog: (p) => {
            const id = attempt?.id
            if (!id) return
            const entry = {id: crypto.randomUUID(), attemptId: id, ts: p.ts, level: p.level, message: p.message}
            setLogs((prev) => [...prev, entry])
            queryClient.setQueryData(cardAttemptKeys.detail(projectId, card.id), (prev: {
                attempt: Attempt;
                logs: AttemptLog[];
                conversation: ConversationItem[]
            } | undefined) => {
                if (!prev) return prev
                return {...prev, logs: [...prev.logs, entry]}
            })
        },
        onMessage: (item) => {
            setConversation((prev) => {
                if (item.id && prev.some((m) => m.id === item.id)) return prev
                return [...prev, item]
            })
            queryClient.setQueryData(cardAttemptKeys.detail(projectId, card.id), (prev: {
                attempt: Attempt;
                logs: AttemptLog[];
                conversation: ConversationItem[]
            } | undefined) => {
                if (!prev) return prev
                const items: ConversationItem[] = prev.conversation ?? []
                if (item.id && items.some((m) => m.id === item.id)) return prev
                return {...prev, conversation: [...items, item]}
            })
        },
        onSession: (sessionId) => {
            setAttempt((prev) => (prev ? {...prev, sessionId} as Attempt : prev))
            queryClient.setQueryData(cardAttemptKeys.detail(projectId, card.id), (prev: {
                attempt: Attempt;
                logs: AttemptLog[];
                conversation: ConversationItem[]
            } | undefined) => {
                if (!prev) return prev
                return {...prev, attempt: {...prev.attempt, sessionId}}
            })
        },
    })

    const handleSave = async () => {
        if (!values.title.trim()) return
        try {
            setSaving(true)
            await onUpdate({
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this ticket?')) return
        try {
            setDeleting(true);
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
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id)})
        },
    })

    const startAttempt = async () => {
        if (!projectId) return
        setStarting(true)
        try {
            await startMutation.mutateAsync({projectId, cardId: card.id, agent, profileId})
        } catch (err) {
            console.error('Start attempt failed', err)
        } finally {
            setStarting(false)
        }
    }

    // Stop is unused in the current UI (no top controls once attempt exists)

    const sendFollowup = async () => {
        if (!attempt || !attempt.sessionId || !followup.trim()) return
        try {
            await followupMutation.mutateAsync({attemptId: attempt.id, prompt: followup, profileId})
        } catch (err) {
            // handled in hook onError; console for dev context
            console.error('Follow-up failed', err)
        }
    }

    const stopMutation = useStopAttempt({
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(variables.attemptId)})
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId, card.id)})
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
            const message = err instanceof Error ? err.message : 'Open failed'
            toast({title: 'Open failed', description: message, variant: 'destructive'})
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
            toast({title: 'Worktree missing', description: 'Start an attempt to run the dev script.', variant: 'destructive'})
            return
        }
        devAutomationMutation.mutate({attemptId: attempt.id})
    }

    // Load latest attempt on first open for this card
    // Scroll to newest message once on card open
    useEffect(() => {
        if (!conversation.length) return
        if (initialScrolledForCardRef.current === card.id) return
        initialScrolledForCardRef.current = card.id
        // Use a rAF to ensure DOM has rendered
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({behavior: 'auto', block: 'end'})
        })
    }, [conversation.length, card.id])

    const processEntries: ProcessEntry[] = (() => {
        const entries: ProcessEntry[] = []
        const attemptStatus: ProcessStatus = attempt?.status ?? 'idle'
        const agentName = attempt?.agent ?? (agent || 'Agent')

        const agentDescriptionParts: string[] = []
        if (attempt?.branchName) agentDescriptionParts.push(`Branch ${attempt.branchName}`)
        if (attempt?.baseBranch) agentDescriptionParts.push(`Base ${attempt.baseBranch}`)
        const agentDescription = agentDescriptionParts.length
            ? agentDescriptionParts.join(' · ')
            : 'Kick off an agent run to automate this task.'

        const recentTs = attempt?.status === 'queued' ? attempt?.createdAt ?? attempt?.updatedAt : attempt?.updatedAt ?? attempt?.startedAt
        const relative = formatRelativeTime(recentTs)
        let agentMeta: ReactNode = null
        if (relative) {
            switch (attemptStatus) {
                case 'queued':
                    agentMeta = `Queued ${relative}`
                    break
                case 'running':
                    agentMeta = `Updated ${relative}`
                    break
                case 'stopping':
                    agentMeta = `Stopping ${relative}`
                    break
                case 'succeeded':
                case 'failed':
                case 'stopped':
                    agentMeta = `Finished ${relative}`
                    break
                default:
                    agentMeta = null
            }
        }

        const agentActions: ProcessAction[] = []
        if (attempt && (attempt.status === 'running' || attempt.status === 'stopping')) {
            agentActions.push({
                id: 'stop-attempt',
                label: stopping || attempt.status === 'stopping' ? 'Stopping…' : 'Stop',
                onClick: () => {
                    void stopAttempt()
                },
                disabled: stopping || attempt.status === 'stopping',
                variant: 'outline',
            })
        }
        if (attempt) {
            agentActions.push({
                id: 'view-logs',
                label: 'View logs',
                onClick: () => setActiveTab('logs'),
                variant: 'ghost',
            })
        }

        entries.push({
            id: 'agent-run',
            icon: <Bot className="size-4"/>,
            name: `${agentName} run`,
            status: attemptStatus,
            description: agentDescription,
            meta: agentMeta,
            actions: agentActions,
        })

        const devStatus: ProcessStatus = devAutomationMutation.isPending
            ? 'running'
            : latestDevAutomation
                ? latestDevAutomation.status === 'succeeded'
                    ? 'succeeded'
                    : latestDevAutomation.status === 'failed'
                        ? 'failed'
                        : 'idle'
                : 'idle'
        const devRelative = latestDevAutomation
            ? formatRelativeTime(latestDevAutomation.completedAt ?? latestDevAutomation.timestamp)
            : null
        const devMeta = (() => {
            if (!devScriptConfigured) return 'Configure a dev script in Project Settings.'
            if (!attempt) return 'Start an attempt to provision a worktree.'
            if (!latestDevAutomation) return 'Ready to launch.'
            const prefix = latestDevAutomation.status === 'succeeded' ? 'Succeeded' : 'Failed'
            return devRelative ? `${prefix} ${devRelative}` : prefix
        })()
        const devDescription = devScriptConfigured
            ? 'Start and monitor the project dev script.'
            : 'Add a dev script in Project Settings to enable quick launches.'
        const devActions: ProcessAction[] = [
            {
                id: 'run-dev',
                label: devAutomationMutation.isPending ? 'Running…' : 'Run dev',
                onClick: handleRunDevScript,
                disabled: devAutomationMutation.isPending || !devScriptConfigured || !attempt,
                variant: 'outline',
                tooltip: !devScriptConfigured
                    ? 'Configure a dev script in Project Settings.'
                    : !attempt
                        ? 'Start an attempt to create a worktree first.'
                        : undefined,
            },
        ]

        entries.push({
            id: 'dev-server',
            icon: <Server className="size-4"/>,
            name: 'Dev script',
            status: devStatus,
            description: devDescription,
            meta: devMeta,
            actions: devActions,
        })

        return entries
    })()

    return (
        <div className="flex h-full flex-col gap-3">
            <InspectorHeader card={card} locked={locked} blocked={blocked} copied={copied}
                             onCopyTicketKey={handleCopyTicketKey} onClose={onClose}/>
            <CardDetailsForm
                values={{title: values.title, description: values.description, dependsOn: values.dependsOn ?? []}}
                onChange={(patch) => setValues((p) => ({...p, ...patch}))}
                locked={locked}
                availableCards={availableCards}
                cardsIndex={cardsIndex}
            />
            <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave}
                        disabled={locked || !values.title.trim() || saving}>{saving ? 'Saving…' : 'Save'}</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete}
                        disabled={deleting || saving}>Delete</Button>
                <div className="ml-auto">
                    <AttemptToolbar
                        attempt={attempt}
                        openButtonDisabledReason={openButtonDisabledReason}
                        onOpenEditor={handleOpenEditor}
                        onOpenChanges={() => setChangesOpen(true)}
                        onOpenCommit={() => setCommitOpen(true)}
                        onOpenPr={() => setPrOpen(true)}
                        onOpenMerge={() => setMergeOpen(true)}
                    />
                </div>
            </div>
            {!attempt && (
                <AttemptCreateForm
                    agents={agents}
                    agent={agent}
                    onAgentChange={(k) => handleAgentSelect(k)}
                    availableProfiles={availableProfiles}
                    profileId={profileId}
                    onProfileChange={(id) => handleProfileSelect(id ?? '__default__')}
                    onStart={startAttempt}
                    locked={locked}
                    blocked={blocked}
                    starting={starting}
                />
            )}
            {attempt && (
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 p-3">
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <div className="text-xs text-muted-foreground">Attempt {attempt.id} —
                            Status: {attempt.status}</div>
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InspectorTab)}
                              className="flex min-h-0 flex-1 flex-col">
                            <TabsList>
                                <TabsTrigger value="messages">Messages</TabsTrigger>
                                <TabsTrigger value="processes">Processes</TabsTrigger>
                                <TabsTrigger value="logs">Logs</TabsTrigger>
                            </TabsList>
                            <TabsContent value="messages" className="flex min-h-0 flex-1 flex-col">
                                <div ref={messagesContainerRef}
                                     className="flex-1 min-h-0 overflow-auto rounded bg-muted/10 p-2 text-sm">
                                    {conversation.length === 0 ? (
                                        <div className="text-muted-foreground">No messages yet…</div>
                                    ) : (
                                        conversation.map((m, index) => (
                                            <MessageRow key={m.id ?? `${m.timestamp}-${index}`} item={m}/>
                                        ))
                                    )}
                                    <div ref={messagesEndRef}/>
                                </div>
                                {!locked && attempt?.sessionId ? (
                                    <div className="mt-2 space-y-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="ins-follow">Follow-up</Label>
                                            <Textarea id="ins-follow" rows={3} value={followup}
                                                      onChange={(e) => setFollowup(e.target.value)}
                                                      placeholder="Ask the agent to continue…"/>
                                        </div>
                                        <div
                                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            {attemptAgent ? (
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs text-muted-foreground">Profile</Label>
                                                    <Select value={profileId ?? '__default__'}
                                                            onValueChange={handleProfileSelect}>
                                                        <SelectTrigger className="w-44 h-8">
                                                            <SelectValue placeholder="DEFAULT"/>
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-60 overflow-y-auto text-xs">
                                                            <SelectItem value="__default__">DEFAULT</SelectItem>
                                                            {followupProfiles.map((p) => (
                                                                <SelectItem key={p.id}
                                                                            value={p.id}>{p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : <span/>}
                                            <div className="flex items-center gap-2">
                                                {attempt.status === 'running' || attempt.status === 'stopping' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={stopAttempt}
                                                        disabled={stopping || attempt.status === 'stopping'}
                                                    >
                                                        {stopping || attempt.status === 'stopping' ? 'Stopping…' : 'Stop'}
                                                    </Button>
                                                ) : null}
                                                <Button size="sm" onClick={sendFollowup}
                                                        disabled={followupMutation.isPending || !followup.trim()}>
                                                    {followupMutation.isPending ? 'Sending…' : 'Send'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </TabsContent>
                            <TabsContent value="processes" className="flex min-h-0 flex-1 flex-col">
                                <ProcessList entries={processEntries}/>
                            </TabsContent>
                            <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col">
                                <LogsPane logs={logs}/>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            )}
            <AttemptChangesDialog attemptId={attempt?.id ?? ''} open={changesOpen && Boolean(attempt?.id)}
                                  onOpenChange={setChangesOpen} title={`Changes — ${values.title}`}/>
            <CommitDialog attemptId={attempt?.id ?? ''} open={commitOpen && Boolean(attempt?.id)}
                          onOpenChange={setCommitOpen}/>
            <CreatePrDialog attemptId={attempt?.id ?? ''} baseBranch={attempt?.baseBranch}
                            defaultTitle={prDefaults.title} defaultBody={prDefaults.body}
                            open={prOpen && Boolean(attempt?.id)} onOpenChange={setPrOpen}/>
            <MergeBaseDialog attemptId={attempt?.id ?? ''} open={mergeOpen && Boolean(attempt?.id)}
                             onOpenChange={setMergeOpen}/>
        </div>
    )
}

// MessageRow moved to './card-inspector/MessageRow'
