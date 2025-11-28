import {useEffect, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'
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

export type SettingsForm = {
    theme: 'system' | 'light' | 'dark'
    language: 'browser' | 'en' | 'ja'
    telemetryEnabled: boolean
    notificationsAgentCompletionSound: boolean
    notificationsDesktop: boolean
    autoStartAgentOnInProgress: boolean
    editorType: EditorType | ''
    gitUserName: string
    gitUserEmail: string
    branchTemplate: string
    ghPrTitleTemplate: string
    ghPrBodyTemplate: string
    ghAutolinkTickets: boolean
}

export type CredentialsState = {
    clientId: string
    clientSecret: string
    hasClientSecret: boolean
    secretAction: 'unchanged' | 'update' | 'clear'
    source: GithubAppConfig['source']
    updatedAt: string | null
}

export const STEP_ORDER = ['welcome', 'general', 'editor', 'github-app', 'github-connect', 'finish'] as const
export type StepId = (typeof STEP_ORDER)[number]

export const STEP_META: Record<StepId, { title: string; description: string }> = {
    welcome: {title: 'Welcome', description: 'A quick pass through preferences and GitHub.'},
    general: {title: 'General preferences', description: 'Theme, language, telemetry, notifications.'},
    editor: {title: 'Editor & Git defaults', description: 'Choose your editor and git identity.'},
    'github-app': {
        title: 'GitHub templates & OAuth app',
        description: 'PR templates and your GitHub app credentials.',
    },
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
        autoStartAgentOnInProgress: data.autoStartAgentOnInProgress,
        editorType: data.editorType,
        gitUserName: data.gitUserName ?? '',
        gitUserEmail: data.gitUserEmail ?? '',
        branchTemplate: data.branchTemplate,
        ghPrTitleTemplate: data.ghPrTitleTemplate ?? '',
        ghPrBodyTemplate: data.ghPrBodyTemplate ?? '',
        ghAutolinkTickets: data.ghAutolinkTickets,
    }
}

export type OnboardingState = {
    stepId: StepId
    stepIndex: number
    stepCount: number
    stepMeta: { title: string; description: string }
    settingsForm: SettingsForm | null
    appCredForm: CredentialsState | null
    installedEditors: { key: EditorType; label: string }[]
    connected: boolean
    connectedUsername: string | null
    onboardingCompleted: boolean
    githubConfigMissingId: boolean
    deviceState: GitHubDeviceStartResponse | null
    polling: boolean
    startingDevice: boolean
    isInitializing: boolean
    queryErrored: boolean
    queryErrorMessages: string[]
    onboardingStatusError: boolean
    completePending: boolean
    saveSettingsPending: boolean
    saveGithubAppPending: boolean
    githubAuthRefreshing: boolean
}

export type OnboardingActions = {
    goNext: () => Promise<void>
    goBack: () => Promise<void>
    saveProgress: () => Promise<void>
    handleDesktopToggle: (checked: boolean) => Promise<void>
    retryPrerequisites: () => void
    refreshGithubStatus: () => void
    startGithubConnect: () => Promise<void>
    setSettingsForm: React.Dispatch<React.SetStateAction<SettingsForm | null>>
    setAppCredForm: React.Dispatch<React.SetStateAction<CredentialsState | null>>
}

export function useOnboardingState(): { state: OnboardingState; actions: OnboardingActions } {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Data hooks
    const onboardingStatus = useOnboardingStatus()
    const progressMutation = useOnboardingProgress()
    const completeMutation = useCompleteOnboarding({
        onSuccess: () => {
            navigate('/', {replace: true})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Could not complete onboarding')
            toast({title, description, variant: 'destructive'})
        },
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
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Save failed')
            toast({title, description, variant: 'destructive'})
        },
    })
    const githubAppQuery = useGithubAppConfig()
    const saveGithubApp = useSaveGithubAppConfig({
        onSuccess: (saved) => {
            const next: CredentialsState = {
                clientId: saved.clientId ?? '',
                clientSecret: '',
                hasClientSecret: saved.hasClientSecret,
                secretAction: 'unchanged',
                source: saved.source,
                updatedAt: saved.updatedAt,
            }
            setAppCredBaseline(next)
            setAppCredForm(next)
            toast({title: 'GitHub app saved', variant: 'success'})
            queryClient.invalidateQueries({queryKey: githubKeys.check()})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Save failed')
            toast({title, description, variant: 'destructive'})
        },
    })
    const githubAuthQuery = useGithubAuthStatus()
    const startDevice = useStartGithubDevice({
        onError: (err) => {
            const {title, description} = describeApiError(err, 'GitHub device start failed')
            toast({title, description, variant: 'destructive'})
        },
    })
    const pollDevice = usePollGithubDevice({
        onError: (err) => {
            const {title, description} = describeApiError(err, 'GitHub device polling failed')
            toast({title, description, variant: 'destructive'})
        },
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
                secretAction: 'unchanged',
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
        if (onboardingStatus.data.lastStep) {
            const idx = STEP_ORDER.findIndex((id) => id === onboardingStatus.data!.lastStep)
            if (idx >= 0) {
                setCurrentStep(idx)
            }
        }
        setResumeApplied(true)
    }, [onboardingStatus.data, resumeApplied])

    // Record progress when step changes
    useEffect(() => {
        if (onboardingStatus.data?.status === 'pending') {
            progressMutation.mutate({step: STEP_ORDER[currentStep]})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, onboardingStatus.data?.status])

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

    const handleDesktopToggle = async (checked: boolean) => {
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
        (appCredForm.clientId.trim() !== appCredBaseline.clientId.trim() || appCredForm.secretAction !== 'unchanged')

    const connected = githubAuthQuery.data?.status === 'valid'
    const githubAccount = githubAuthQuery.data?.status === 'valid' ? githubAuthQuery.data.account : null
    const connectedUsername = githubAccount?.username ?? null
    const onboardingCompleted = onboardingStatus.data?.status === 'completed'
    const githubConfigMissingId = (appCredForm?.clientId.trim() ?? '').length === 0

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
                    queryClient.setQueryData(
                        githubKeys.check(),
                        {status: 'valid', account: result.account} satisfies GitHubCheckResponse,
                    )
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
            autoStartAgentOnInProgress: settingsForm.autoStartAgentOnInProgress,
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
            clientSecret:
                appCredForm.secretAction === 'unchanged'
                    ? undefined
                    : appCredForm.secretAction === 'clear'
                        ? null
                        : appCredForm.clientSecret.trim() || null,
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

    const saveProgress = async () => {
        const stepId = STEP_ORDER[currentStep]
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
    }

    const queryErrored = settingsQuery.isError || githubAppQuery.isError || editorsQuery.isError
    const queryErrorMessages = [
        settingsQuery.error instanceof Error ? settingsQuery.error.message : null,
        githubAppQuery.error instanceof Error ? githubAppQuery.error.message : null,
        editorsQuery.error instanceof Error ? editorsQuery.error.message : null,
    ].filter((msg): msg is string => Boolean(msg))

    const retryPrerequisites = () => {
        settingsQuery.refetch()
        githubAppQuery.refetch()
        editorsQuery.refetch()
        onboardingStatus.refetch()
    }

    const state: OnboardingState = {
        stepId: STEP_ORDER[currentStep],
        stepIndex: currentStep,
        stepCount: STEP_ORDER.length,
        stepMeta: STEP_META[STEP_ORDER[currentStep]],
        settingsForm,
        appCredForm,
        installedEditors,
        connected,
        connectedUsername,
        onboardingCompleted,
        githubConfigMissingId,
        deviceState,
        polling,
        startingDevice,
        isInitializing: anyLoading || !settingsForm || !appCredForm || onboardingStatus.isLoading,
        queryErrored,
        queryErrorMessages,
        onboardingStatusError: onboardingStatus.isError,
        completePending: completeMutation.isPending,
        saveSettingsPending: updateSettings.isPending,
        saveGithubAppPending: saveGithubApp.isPending,
        githubAuthRefreshing: githubAuthQuery.isFetching,
    }

    const actions: OnboardingActions = {
        goNext: () => goToStep(1),
        goBack: () => goToStep(-1),
        saveProgress,
        handleDesktopToggle,
        retryPrerequisites,
        refreshGithubStatus: () => {
            queryClient.invalidateQueries({queryKey: githubKeys.check()})
        },
        startGithubConnect,
        setSettingsForm,
        setAppCredForm,
    }

    return {state, actions}
}
