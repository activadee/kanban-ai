import {useEffect, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import type {CheckedState} from '@radix-ui/react-checkbox'
import {Loader2, Check, ArrowLeft, ArrowRight, ShieldCheck, Rocket} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Separator} from '@/components/ui/separator'
import {toast} from '@/components/ui/toast'
import {GeneralSettingsSection} from './app-settings/GeneralSettingsSection'
import {EditorSettingsSection} from './app-settings/EditorSettingsSection'
import {GitDefaultsSection} from './app-settings/GitDefaultsSection'
import {GithubSettingsSection} from './app-settings/GithubSettingsSection'
import {GithubAppCredentialsFields} from '@/components/github/GithubAppCredentialsFields'
import {GitHubIcon} from '@/components/icons/SimpleIcons'
import {cn} from '@/lib/utils'
import {
    useAppSettings,
    useCompleteOnboarding,
    useEditors,
    useGithubAppConfig,
    useGithubAuthStatus,
    useOnboardingProgress,
    useOnboardingStatus,
    usePollGithubDevice,
    useSaveGithubAppConfig,
    useStartGithubDevice,
    useUpdateAppSettings,
} from '@/hooks'
import type {
    EditorType,
    GitHubCheckResponse,
    GitHubDeviceStartResponse,
    GithubAppConfig,
    UpdateAppSettingsRequest,
} from 'shared'
import {githubKeys} from '@/lib/queryClient'

type SettingsForm = {
    theme: 'system' | 'light' | 'dark'
    language: 'browser' | 'en' | 'ja'
    telemetryEnabled: boolean
    notificationsAgentCompletionSound: boolean
    notificationsDesktop: boolean
    editorType: EditorType | ''
    gitUserName: string
    gitUserEmail: string
    branchTemplate: string
    ghPrTitleTemplate: string
    ghPrBodyTemplate: string
    ghAutolinkTickets: boolean
}

type CredentialsState = {
    clientId: string
    clientSecret: string
    hasClientSecret: boolean
    source: GithubAppConfig['source']
    updatedAt: string | null
}

const STEP_ORDER = ['welcome', 'general', 'editor', 'github-app', 'github-connect', 'finish'] as const
type StepId = (typeof STEP_ORDER)[number]

const STEP_META: Record<StepId, { title: string; description: string }> = {
    welcome: {title: 'Welcome', description: 'A quick pass through preferences and GitHub.'},
    general: {title: 'General preferences', description: 'Theme, language, telemetry, notifications.'},
    editor: {title: 'Editor & Git defaults', description: 'Choose your editor and git identity.'},
    'github-app': {title: 'GitHub templates & OAuth app', description: 'PR templates and your GitHub app credentials.'},
    'github-connect': {title: 'Connect GitHub', description: 'Authorize KanbanAI via device flow.'},
    finish: {title: 'All set', description: 'Review and enter the workspace.'},
}

function toSettingsForm(data: NonNullable<Awaited<ReturnType<typeof useAppSettings>['data']>>): SettingsForm {
    return {
        theme: data.theme,
        language: data.language,
        telemetryEnabled: data.telemetryEnabled,
        notificationsAgentCompletionSound: data.notificationsAgentCompletionSound,
        notificationsDesktop: data.notificationsDesktop,
        editorType: data.editorType,
        gitUserName: data.gitUserName ?? '',
        gitUserEmail: data.gitUserEmail ?? '',
        branchTemplate: data.branchTemplate,
        ghPrTitleTemplate: data.ghPrTitleTemplate ?? '',
        ghPrBodyTemplate: data.ghPrBodyTemplate ?? '',
        ghAutolinkTickets: data.ghAutolinkTickets,
    }
}

export function OnboardingPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Data hooks
    const onboardingStatus = useOnboardingStatus()
    const progressMutation = useOnboardingProgress()
    const completeMutation = useCompleteOnboarding({
        onSuccess: () => {
            navigate('/', {replace: true})
        },
        onError: (err) => toast({title: 'Could not complete onboarding', description: err.message, variant: 'destructive'}),
    })
    const settingsQuery = useAppSettings()
    const editorsQuery = useEditors()
    const updateSettings = useUpdateAppSettings({
        onSuccess: (result) => {
            const next = toSettingsForm(result)
            setSettingsBaseline(next)
            setSettingsForm(next)
            toast({title: 'Settings saved', variant: 'success'})
        },
        onError: (err) => toast({title: 'Save failed', description: err.message, variant: 'destructive'}),
    })
    const githubAppQuery = useGithubAppConfig()
    const saveGithubApp = useSaveGithubAppConfig({
        onSuccess: (saved) => {
            const next: CredentialsState = {
                clientId: saved.clientId ?? '',
                clientSecret: '',
                hasClientSecret: saved.hasClientSecret,
                source: saved.source,
                updatedAt: saved.updatedAt,
            }
            setAppCredBaseline(next)
            setAppCredForm(next)
            toast({title: 'GitHub app saved', variant: 'success'})
            queryClient.invalidateQueries({queryKey: githubKeys.check()})
        },
        onError: (err) => toast({title: 'Save failed', description: err.message, variant: 'destructive'}),
    })
    const githubAuthQuery = useGithubAuthStatus()
    const startDevice = useStartGithubDevice({
        onError: (err) => toast({title: 'GitHub device start failed', description: err.message, variant: 'destructive'}),
    })
    const pollDevice = usePollGithubDevice({
        onError: (err) => toast({title: 'GitHub device polling failed', description: err.message, variant: 'destructive'}),
    })

    // Local state
    const [settingsBaseline, setSettingsBaseline] = useState<SettingsForm | null>(null)
    const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null)
    const [appCredBaseline, setAppCredBaseline] = useState<CredentialsState | null>(null)
    const [appCredForm, setAppCredForm] = useState<CredentialsState | null>(null)
    const [currentStep, setCurrentStep] = useState<number>(0)
    const [deviceState, setDeviceState] = useState<GitHubDeviceStartResponse | null>(null)
    const [polling, setPolling] = useState(false)
    const [startingDevice, setStartingDevice] = useState(false)
    const [resumeApplied, setResumeApplied] = useState(false)

    // Map query data -> local form
    const initialSettings = useMemo(
        () => (settingsQuery.data ? toSettingsForm(settingsQuery.data) : null),
        [settingsQuery.data],
    )

    useEffect(() => {
        if (initialSettings) {
            setSettingsBaseline(initialSettings)
            setSettingsForm((prev) => prev ?? initialSettings)
        }
    }, [initialSettings])

    useEffect(() => {
        if (githubAppQuery.data) {
            const incoming: CredentialsState = {
                clientId: githubAppQuery.data.clientId ?? '',
                clientSecret: '',
                hasClientSecret: githubAppQuery.data.hasClientSecret,
                source: githubAppQuery.data.source,
                updatedAt: githubAppQuery.data.updatedAt,
            }
            setAppCredBaseline(incoming)
            setAppCredForm((prev) => prev ?? incoming)
        }
    }, [githubAppQuery.data])

    // Resume from last recorded step if user reloads mid-onboarding
    useEffect(() => {
        if (resumeApplied || !onboardingStatus.data) return
        if (onboardingStatus.data.status === 'completed') {
            navigate('/', {replace: true})
            return
        }
        if (onboardingStatus.data.lastStep) {
            const idx = STEP_ORDER.findIndex((id) => id === onboardingStatus.data!.lastStep)
            if (idx >= 0) {
                setCurrentStep(Math.min(idx + 1, STEP_ORDER.length - 1))
            }
        }
        setResumeApplied(true)
    }, [onboardingStatus.data, navigate, resumeApplied])

    // Record progress when step changes
    useEffect(() => {
        if (onboardingStatus.data?.status === 'pending') {
            progressMutation.mutate({step: STEP_ORDER[currentStep]})
        }
    }, [currentStep, onboardingStatus.data?.status]) // eslint-disable-line react-hooks/exhaustive-deps

    // Editor fallback (reuse logic from settings page)
    const installedEditors = useMemo(
        () => (editorsQuery.data ?? []).filter((editor) => editor.installed) as { key: EditorType; label: string }[],
        [editorsQuery.data],
    )
    useEffect(() => {
        setSettingsForm((prev) => {
            if (!prev) return prev
            if (!installedEditors.length) {
                return prev.editorType === '' ? prev : {...prev, editorType: ''}
            }
            if (installedEditors.some((editor) => editor.key === prev.editorType)) {
                return prev
            }
            const fallback = installedEditors[0]
            return fallback ? {...prev, editorType: fallback.key as EditorType} : prev
        })
    }, [installedEditors])

    // Desktop notification toggle (copied from AppSettings)
    const updateNotificationsDesktop = (value: boolean) => {
        setSettingsForm((prev) => (prev ? {...prev, notificationsDesktop: value} : prev))
    }
    const handleDesktopToggle = async (checked: CheckedState) => {
        if (!settingsForm) return
        if (checked !== true) {
            updateNotificationsDesktop(false)
            return
        }

        if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
            toast({
                title: 'Desktop notifications unavailable',
                description: 'Your browser does not support desktop notifications.',
                variant: 'destructive',
            })
            updateNotificationsDesktop(false)
            return
        }

        const permission = window.Notification.permission

        if (permission === 'granted') {
            updateNotificationsDesktop(true)
            return
        }

        if (permission === 'denied') {
            toast({
                title: 'Permission blocked',
                description: 'Enable notifications in your browser settings to turn this on.',
                variant: 'destructive',
            })
            updateNotificationsDesktop(false)
            return
        }

        try {
            const result = await window.Notification.requestPermission()
            if (result === 'granted') {
                updateNotificationsDesktop(true)
            } else {
                toast({
                    title: 'Permission declined',
                    description: 'Desktop notifications remain disabled.',
                    variant: 'destructive',
                })
                updateNotificationsDesktop(false)
            }
        } catch (error) {
            console.error('Notification permission request failed', error)
            toast({
                title: 'Permission request failed',
                description: 'Unable to enable desktop notifications.',
                variant: 'destructive',
            })
            updateNotificationsDesktop(false)
        }
    }

    const settingsDirty =
        settingsForm && settingsBaseline && JSON.stringify(settingsForm) !== JSON.stringify(settingsBaseline)
    const appCredDirty =
        appCredForm &&
        appCredBaseline &&
        (appCredForm.clientId.trim() !== appCredBaseline.clientId.trim() || appCredForm.clientSecret.trim().length > 0)

    const connected = githubAuthQuery.data?.status === 'valid'
    const githubAccount = githubAuthQuery.data?.status === 'valid' ? githubAuthQuery.data.account : null
    const connectedUsername = githubAccount?.username ?? null
    const githubConfigMissing = (appCredForm?.clientId.trim() ?? '').length === 0 || !appCredForm?.hasClientSecret

    const anyLoading =
        onboardingStatus.isLoading ||
        settingsQuery.isLoading ||
        githubAppQuery.isLoading ||
        githubAuthQuery.isFetching ||
        editorsQuery.isLoading

    const pollGithubDevice = pollDevice.mutateAsync

    useEffect(() => {
        if (!polling || !deviceState) return
        let cancelled = false
        let timer: number | undefined
        let inFlight = false
        const poll = async () => {
            if (cancelled || inFlight) return
            inFlight = true
            try {
                const result = await pollGithubDevice()
                if (cancelled) return
                if (result.status === 'authorization_pending') {
                    timer = window.setTimeout(poll, deviceState.interval * 1000)
                } else if (result.status === 'slow_down') {
                    const retryMs = (result.retryAfterSeconds ?? deviceState.interval + 5) * 1000
                    timer = window.setTimeout(poll, retryMs)
                } else if (result.status === 'success') {
                    setPolling(false)
                    setDeviceState(null)
                    // Immediately reflect connection in query cache so the UI flips to "Connected" without waiting
                    queryClient.setQueryData(githubKeys.check(), {status: 'valid', account: result.account} satisfies GitHubCheckResponse)
                    await queryClient.invalidateQueries({queryKey: githubKeys.check()})
                    toast({title: 'GitHub connected', variant: 'success'})
                } else {
                    setPolling(false)
                    setDeviceState(null)
                }
            } catch (err) {
                console.error('poll error', err)
                if (!cancelled) {
                    setPolling(false)
                    setDeviceState(null)
                }
            } finally {
                inFlight = false
            }
        }
        timer = window.setTimeout(poll, 0)
        return () => {
            cancelled = true
            if (typeof timer === 'number') window.clearTimeout(timer)
        }
    }, [polling, deviceState, pollGithubDevice, queryClient])

    const saveSettings = async () => {
        if (!settingsForm) return
        const payload: UpdateAppSettingsRequest = {
            theme: settingsForm.theme,
            language: settingsForm.language,
            telemetryEnabled: settingsForm.telemetryEnabled,
            notificationsAgentCompletionSound: settingsForm.notificationsAgentCompletionSound,
            notificationsDesktop: settingsForm.notificationsDesktop,
            editorType: settingsForm.editorType || undefined,
            gitUserName: settingsForm.gitUserName.trim() || null,
            gitUserEmail: settingsForm.gitUserEmail.trim() || null,
            branchTemplate: settingsForm.branchTemplate,
            ghPrTitleTemplate: settingsForm.ghPrTitleTemplate.trim() || null,
            ghPrBodyTemplate: settingsForm.ghPrBodyTemplate.trim() || null,
            ghAutolinkTickets: settingsForm.ghAutolinkTickets,
        }
        await updateSettings.mutateAsync(payload)
    }

    const saveGithubCredentials = async () => {
        if (!appCredForm) return
        await saveGithubApp.mutateAsync({
            clientId: appCredForm.clientId.trim(),
            clientSecret: appCredForm.clientSecret.trim() || null,
        })
    }

    const startGithubConnect = async () => {
        setStartingDevice(true)
        try {
            const payload = await startDevice.mutateAsync()
            setDeviceState(payload)
            setPolling(true)
            try {
                await navigator.clipboard.writeText(payload.userCode)
            } catch (err) {
                console.warn('clipboard copy failed', err)
            }
            window.open(payload.verificationUri, '_blank', 'noopener,noreferrer')
        } catch (err) {
            console.error('start device flow failed', err)
        } finally {
            setStartingDevice(false)
        }
    }

    const goToStep = async (direction: 1 | -1) => {
        const stepId = STEP_ORDER[currentStep]
        if (stepId === 'finish' && direction === 1) {
            await completeMutation.mutateAsync({step: 'finish'})
            return
        }
        const target = currentStep + direction
        if (target < 0 || target >= STEP_ORDER.length) return
        try {
            if (['general', 'editor', 'github-app'].includes(stepId) && settingsDirty) {
                await saveSettings()
            }
            if (stepId === 'github-app' && appCredDirty && appCredForm?.clientId.trim()) {
                await saveGithubCredentials()
            }
            setCurrentStep(target)
        } catch (err) {
            console.error('step advance failed', err)
        }
    }

    if (anyLoading || !settingsForm || !appCredForm || onboardingStatus.isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin"/>
                Preparing onboarding…
            </div>
        )
    }

    if (onboardingStatus.isError) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-sm text-destructive">
                Unable to load onboarding status. Please retry.
            </div>
        )
    }

    const stepId = STEP_ORDER[currentStep]
    const stepMeta = STEP_META[stepId]

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-secondary/60 via-background to-accent/30 text-foreground">
            <aside className="hidden w-72 flex-col border-r border-border/60 bg-card/70 px-4 py-6 lg:flex">
                <div className="flex items-center gap-2 pb-6">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                        <Rocket className="size-4"/>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-foreground">Welcome aboard</div>
                        <div className="text-xs text-muted-foreground">Guide takes ~2 minutes</div>
                    </div>
                </div>
                <ol className="space-y-3">
                    {STEP_ORDER.map((id, idx) => (
                        <li
                            key={id}
                            className={cn(
                                'rounded-md border px-3 py-2 transition-colors',
                                idx === currentStep
                                    ? 'border-primary/50 bg-primary/5'
                                    : idx < currentStep
                                        ? 'border-green-500/50 bg-green-500/10'
                                        : 'border-border/70 bg-card/70',
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={idx < currentStep ? 'secondary' : 'outline'}
                                    className={cn('rounded-full px-2', idx < currentStep && 'bg-green-500/20 text-green-900')}
                                >
                                    {idx < currentStep ? <Check className="size-3.5"/> : idx + 1}
                                </Badge>
                                <div>
                                    <div className="text-sm font-semibold">{STEP_META[id].title}</div>
                                    <div className="text-xs text-muted-foreground">{STEP_META[id].description}</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            </aside>

            <div className="flex-1">
                <header className="border-b border-border/60 bg-card/60 px-6 py-4 backdrop-blur">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
                            <h1 className="text-xl font-semibold text-foreground">{stepMeta.title}</h1>
                            <p className="text-sm text-muted-foreground">{stepMeta.description}</p>
                        </div>
                        <Badge variant="secondary">{currentStep + 1} / {STEP_ORDER.length}</Badge>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-5xl px-6 py-8">
                    <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
                        {stepId === 'welcome' ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-semibold text-foreground">Let&apos;s tailor KanbanAI to you</h2>
                                    <p className="text-sm text-muted-foreground">
                                        We&apos;ll capture your preferences, Git defaults, GitHub templates, and connect your GitHub account.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div className="rounded-lg border border-border/70 bg-muted/50 p-4">
                                        <div className="text-sm font-semibold">Personalize</div>
                                        <div className="mt-1 text-xs text-muted-foreground">Theme, language, notifications, editor.</div>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-muted/50 p-4">
                                        <div className="text-sm font-semibold">Git & PR templates</div>
                                        <div className="mt-1 text-xs text-muted-foreground">Git identity, branch naming, PR title/body.</div>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-muted/50 p-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <GitHubIcon className="size-4"/> GitHub connect
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">Store OAuth app keys and authorize the app.</div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {stepId === 'general' ? (
                            <GeneralSettingsSection
                                form={{
                                    theme: settingsForm.theme,
                                    language: settingsForm.language,
                                    telemetryEnabled: settingsForm.telemetryEnabled,
                                    notificationsAgentCompletionSound: settingsForm.notificationsAgentCompletionSound,
                                    notificationsDesktop: settingsForm.notificationsDesktop,
                                }}
                                onChange={(patch) => setSettingsForm({...settingsForm, ...patch})}
                                onDesktopToggle={(v) => handleDesktopToggle(v)}
                            />
                        ) : null}

                        {stepId === 'editor' ? (
                            <div className="space-y-6">
                                <EditorSettingsSection
                                    editorType={settingsForm.editorType}
                                    installed={installedEditors}
                                    onChange={(v) => setSettingsForm({...settingsForm, editorType: v})}
                                />
                                <Separator/>
                                <GitDefaultsSection
                                    form={{
                                        gitUserName: settingsForm.gitUserName,
                                        gitUserEmail: settingsForm.gitUserEmail,
                                        branchTemplate: settingsForm.branchTemplate,
                                    }}
                                    onChange={(patch) => setSettingsForm({...settingsForm, ...patch})}
                                />
                            </div>
                        ) : null}

                        {stepId === 'github-app' ? (
                            <div className="space-y-6">
                                <GithubSettingsSection
                                    form={{
                                        ghAutolinkTickets: settingsForm.ghAutolinkTickets,
                                        ghPrTitleTemplate: settingsForm.ghPrTitleTemplate,
                                        ghPrBodyTemplate: settingsForm.ghPrBodyTemplate,
                                    }}
                                    onChange={(patch) => setSettingsForm({...settingsForm, ...patch})}
                                />
                                <Separator/>
                                {appCredForm ? (
                                    <GithubAppCredentialsFields
                                        value={appCredForm}
                                        onChange={(patch) => setAppCredForm({...appCredForm, ...patch})}
                                        disabled={saveGithubApp.isPending}
                                    />
                                ) : null}
                            </div>
                        ) : null}

                        {stepId === 'github-connect' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <GitHubIcon className="size-5"/>
                                    <div className="text-lg font-semibold">Connect GitHub</div>
                                    {connected ? (
                                        <Badge variant="secondary" className="bg-green-500/20 text-green-900">Connected</Badge>
                                    ) : (
                                        <Badge variant="outline">Not connected</Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Use GitHub&apos;s device flow to grant KanbanAI access. We never see your credentials; tokens stay in your local database.
                                </p>
                                <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="text-sm font-medium">
                                                {connected ? `Signed in as ${connectedUsername}` : 'Awaiting authorization'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {githubConfigMissing
                                                    ? 'Add client ID and secret first, then start the flow.'
                                                    : connected
                                                        ? 'You can continue to the app.'
                                                        : 'Click connect to open GitHub and enter the device code.'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => queryClient.invalidateQueries({queryKey: githubKeys.check()})}
                                                disabled={githubAuthQuery.isFetching}
                                            >
                                                <Loader2 className={cn('mr-2 size-4', githubAuthQuery.isFetching && 'animate-spin')}/>
                                                Refresh
                                            </Button>
                                            <Button
                                                onClick={startGithubConnect}
                                                disabled={githubConfigMissing || startingDevice || polling || connected}
                                            >
                                                {startingDevice ? (
                                                    <>
                                                        <Loader2 className="mr-2 size-4 animate-spin"/>Starting…
                                                    </>
                                                ) : connected ? (
                                                    'Connected'
                                                ) : (
                                                    'Connect GitHub'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    {!connected && deviceState ? (
                                        <div className="mt-3 rounded-md border border-dashed border-border/80 bg-card/80 p-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Device code</span>
                                                <span className="font-mono tracking-widest text-foreground">{deviceState.userCode}</span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                                Enter this code at
                                                <button
                                                    className="text-primary underline"
                                                    onClick={() => window.open(deviceState.verificationUri, '_blank', 'noopener,noreferrer')}
                                                >
                                                    github.com/login/device
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                    {githubConfigMissing ? (
                                        <p className="mt-3 text-xs text-destructive">
                                            GitHub app credentials are missing. Add a client ID and secret in the previous step.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        {stepId === 'finish' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-lg font-semibold">
                                    <ShieldCheck className="size-5 text-green-500"/>
                                    You&apos;re ready to go
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Preferences saved {connected ? 'and GitHub connected.' : '— connect GitHub anytime from the sidebar.'}
                                </p>
                                <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                                    <div className="text-sm font-medium">Next up</div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                        <li>Create your first project</li>
                                        <li>Import GitHub issues into Kanban columns</li>
                                        <li>Kick off an agent run from any card</li>
                                    </ul>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Step {currentStep + 1} of {STEP_ORDER.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" disabled={currentStep === 0 || completeMutation.isPending}
                                    onClick={() => goToStep(-1)}>
                                <ArrowLeft className="mr-1 size-4"/>Back
                            </Button>
                            <Button
                                variant="outline"
                                disabled={updateSettings.isPending || saveGithubApp.isPending}
                                onClick={async () => {
                                    try {
                                        if (['general', 'editor', 'github-app'].includes(stepId)) {
                                            await saveSettings()
                                            if (stepId === 'github-app' && appCredDirty && appCredForm?.clientId.trim()) {
                                                await saveGithubCredentials()
                                            }
                                        }
                                        toast({title: 'Progress saved', variant: 'success'})
                                    } catch (err) {
                                        console.error('save progress failed', err)
                                    }
                                }}
                            >
                                Save progress
                            </Button>
                            <Button
                                onClick={() => goToStep(1)}
                                disabled={
                                    completeMutation.isPending ||
                                    startingDevice ||
                                    (stepId === 'github-app' && !appCredForm.clientId.trim())
                                }
                            >
                                {stepId === 'finish'
                                    ? completeMutation.isPending
                                        ? (<><Loader2 className="mr-2 size-4 animate-spin"/>Finishing…</>)
                                        : 'Enter app'
                                    : (
                                        <>
                                            Next <ArrowRight className="ml-1 size-4"/>
                                        </>
                                    )}
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
