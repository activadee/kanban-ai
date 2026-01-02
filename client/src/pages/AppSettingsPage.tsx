import {toast} from '@/components/ui/toast'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {useEffect, useMemo, useState} from 'react'
import type {CheckedState} from '@radix-ui/react-checkbox'
import {useAppSettings, useGithubAppConfig, useSaveGithubAppConfig, useUpdateAppSettings, useValidateEditorPath} from '@/hooks'
import type {GithubAppConfig, UpdateAppSettingsRequest} from 'shared'
import {GeneralSettingsSection} from './app-settings/GeneralSettingsSection'
import {EditorSettingsSection} from './app-settings/EditorSettingsSection'
import {GitDefaultsSection} from './app-settings/GitDefaultsSection'
import {GithubSettingsSection} from './app-settings/GithubSettingsSection'
import {OpencodeAgentSettingsSection} from './app-settings/OpencodeAgentSettingsSection'
import {GithubOAuthSection} from './app-settings/GithubOAuthSection'
import {StreamdownSettingsSection} from './app-settings/StreamdownSettingsSection'
import {describeApiError} from '@/api/http'
import {PageHeader} from '@/components/layout/PageHeader'
import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'
import {Settings, Terminal, GitBranch, Github, Bot, Key, FileText} from 'lucide-react'

type FormState = {
    theme: 'system' | 'light' | 'dark'
    language: 'browser' | 'en' | 'ja'
    telemetryEnabled: boolean
    notificationsAgentCompletionSound: boolean
    notificationsDesktop: boolean
    autoStartAgentOnInProgress: boolean
    editorCommand: string | null
    gitUserName: string
    gitUserEmail: string
    branchTemplate: string
    ghPrTitleTemplate: string
    ghPrBodyTemplate: string
    ghAutolinkTickets: boolean
    opencodePort: number
    streamdownAssistantEnabled: boolean
    streamdownUserEnabled: boolean
    streamdownSystemEnabled: boolean
    streamdownThinkingEnabled: boolean
}

type GithubAppForm = {
    clientId: string
    clientSecret: string
    hasClientSecret: boolean
    secretAction: 'unchanged' | 'update' | 'clear'
    source: GithubAppConfig['source']
    updatedAt: string | null
}

const SETTINGS_ITEMS: MasterDetailItem[] = [
    {id: 'general', label: 'General', subtitle: 'Theme, language, notifications', icon: Settings},
    {id: 'rendering', label: 'Rendering', subtitle: 'Message display options', icon: FileText},
    {id: 'editor', label: 'Editor', subtitle: 'External editor command', icon: Terminal},
    {id: 'git', label: 'Git Defaults', subtitle: 'User, email, branch template', icon: GitBranch},
    {id: 'github', label: 'GitHub', subtitle: 'PR templates, autolink', icon: Github},
    {id: 'opencode', label: 'OpenCode Agent', subtitle: 'Port configuration', icon: Bot},
    {id: 'oauth', label: 'GitHub OAuth', subtitle: 'Client ID and secret', icon: Key},
]

type SectionId = (typeof SETTINGS_ITEMS)[number]['id']

export function AppSettingsPage() {
    const {data, isLoading} = useAppSettings()
    const validateEditor = useValidateEditorPath()
    const githubAppQuery = useGithubAppConfig()
    const [form, setForm] = useState<FormState | null>(null)
    const [editorValidationStatus, setEditorValidationStatus] = useState<'valid' | 'invalid' | 'pending' | null>(null)
    const [appCredForm, setAppCredForm] = useState<GithubAppForm | null>(null)
    const [appCredInitial, setAppCredInitial] = useState<GithubAppForm | null>(null)
    const [activeSection, setActiveSection] = useState<SectionId>('general')
    const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

    const initial = useMemo(() => {
        if (!data) return null
        return {
            theme: data.theme,
            language: data.language,
            telemetryEnabled: data.telemetryEnabled,
            notificationsAgentCompletionSound: data.notificationsAgentCompletionSound,
            notificationsDesktop: data.notificationsDesktop,
            autoStartAgentOnInProgress: data.autoStartAgentOnInProgress,
            editorCommand: data.editorCommand,
            gitUserName: data.gitUserName ?? '',
            gitUserEmail: data.gitUserEmail ?? '',
            branchTemplate: data.branchTemplate,
            ghPrTitleTemplate: data.ghPrTitleTemplate ?? '',
            ghPrBodyTemplate: data.ghPrBodyTemplate ?? '',
            ghAutolinkTickets: data.ghAutolinkTickets,
            opencodePort: data.opencodePort,
            streamdownAssistantEnabled: data.streamdownAssistantEnabled,
            streamdownUserEnabled: data.streamdownUserEnabled,
            streamdownSystemEnabled: data.streamdownSystemEnabled,
            streamdownThinkingEnabled: data.streamdownThinkingEnabled,
        } satisfies FormState
    }, [data])

    useEffect(() => {
        if (initial && !form) setForm(initial)
    }, [initial, form])

    useEffect(() => {
        if (githubAppQuery.data) {
            const incoming: GithubAppForm = {
                clientId: githubAppQuery.data.clientId ?? '',
                clientSecret: '',
                hasClientSecret: githubAppQuery.data.hasClientSecret,
                secretAction: 'unchanged',
                source: githubAppQuery.data.source,
                updatedAt: githubAppQuery.data.updatedAt,
            }
            setAppCredInitial(incoming)
            setAppCredForm((prev) => prev ?? incoming)
        }
    }, [githubAppQuery.data])

    const dirty = form && initial && JSON.stringify(form) !== JSON.stringify(initial)
    const appCredDirty =
        appCredForm &&
        appCredInitial &&
        (appCredForm.clientId.trim() !== appCredInitial.clientId.trim() || appCredForm.secretAction !== 'unchanged')

    const updateSettings = useUpdateAppSettings({
        onSuccess: (result) => {
            toast({title: 'Settings saved', variant: 'success'})
            setStatus('saved')
            const next: FormState = {
                theme: result.theme,
                language: result.language,
                telemetryEnabled: result.telemetryEnabled,
                notificationsAgentCompletionSound: result.notificationsAgentCompletionSound,
                notificationsDesktop: result.notificationsDesktop,
                autoStartAgentOnInProgress: result.autoStartAgentOnInProgress,
                editorCommand: result.editorCommand,
                gitUserName: result.gitUserName ?? '',
                gitUserEmail: result.gitUserEmail ?? '',
                branchTemplate: result.branchTemplate,
                ghPrTitleTemplate: result.ghPrTitleTemplate ?? '',
                ghPrBodyTemplate: result.ghPrBodyTemplate ?? '',
                ghAutolinkTickets: result.ghAutolinkTickets,
                opencodePort: result.opencodePort,
                streamdownAssistantEnabled: result.streamdownAssistantEnabled,
                streamdownUserEnabled: result.streamdownUserEnabled,
                streamdownSystemEnabled: result.streamdownSystemEnabled,
                streamdownThinkingEnabled: result.streamdownThinkingEnabled,
            }
            setForm(next)
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Save failed')
            toast({title, description, variant: 'destructive'})
            setStatus('error')
        },
    })

    const saveGithubApp = useSaveGithubAppConfig({
        onSuccess: (saved) => {
            const next: GithubAppForm = {
                clientId: saved.clientId ?? '',
                clientSecret: '',
                hasClientSecret: saved.hasClientSecret,
                secretAction: 'unchanged',
                source: saved.source,
                updatedAt: saved.updatedAt,
            }
            setAppCredInitial(next)
            setAppCredForm(next)
            toast({title: 'GitHub app saved', variant: 'success'})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Save failed')
            toast({title, description, variant: 'destructive'})
        },
    })

    const save = () => {
        if (!form) return
        setStatus('idle')
        const payload: UpdateAppSettingsRequest = {
            theme: form.theme,
            language: form.language,
            telemetryEnabled: form.telemetryEnabled,
            notificationsAgentCompletionSound: form.notificationsAgentCompletionSound,
            notificationsDesktop: form.notificationsDesktop,
            autoStartAgentOnInProgress: form.autoStartAgentOnInProgress,
            editorCommand: form.editorCommand || null,
            gitUserName: form.gitUserName.trim() || null,
            gitUserEmail: form.gitUserEmail.trim() || null,
            branchTemplate: form.branchTemplate,
            ghPrTitleTemplate: form.ghPrTitleTemplate.trim() || null,
            ghPrBodyTemplate: form.ghPrBodyTemplate.trim() || null,
            ghAutolinkTickets: form.ghAutolinkTickets,
            opencodePort: form.opencodePort,
            streamdownAssistantEnabled: form.streamdownAssistantEnabled,
            streamdownUserEnabled: form.streamdownUserEnabled,
            streamdownSystemEnabled: form.streamdownSystemEnabled,
            streamdownThinkingEnabled: form.streamdownThinkingEnabled,
        }
        updateSettings.mutate(payload)
    }

    const updateNotificationsDesktop = (value: boolean) => {
        setForm((prev) => (prev ? {...prev, notificationsDesktop: value} : prev))
    }

    const handleDesktopToggle = async (checked: CheckedState) => {
        if (!form) return
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

    useEffect(() => {
        if (!form?.editorCommand) {
            setEditorValidationStatus(null)
            return
        }
        setEditorValidationStatus('pending')
        validateEditor.mutateAsync(form.editorCommand).then((result) => {
            setEditorValidationStatus(result.valid ? 'valid' : 'invalid')
        }).catch(() => {
            setEditorValidationStatus('invalid')
        })
    }, [form?.editorCommand])

    const handleReset = () => {
        if (initial) setForm(initial)
        setStatus('idle')
    }

    const handleOAuthReset = () => {
        if (appCredInitial) setAppCredForm(appCredInitial)
    }

    const handleOAuthSave = () => {
        if (!appCredForm) return
        saveGithubApp.mutate({
            clientId: appCredForm.clientId.trim(),
            clientSecret:
                appCredForm.secretAction === 'unchanged'
                    ? undefined
                    : appCredForm.secretAction === 'clear'
                        ? null
                        : appCredForm.clientSecret.trim() || null,
        })
    }

    if (isLoading && !data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <p className="text-sm text-muted-foreground">Loading settings...</p>
                </div>
            </div>
        )
    }

    if (data && !form) setForm(initial)

    const renderContent = () => {
        if (!form) return null

        const contentWrapper = (children: React.ReactNode) => (
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                {children}
            </div>
        )

        switch (activeSection) {
            case 'general':
                return contentWrapper(
                    <GeneralSettingsSection
                        form={form}
                        onChange={(p) => {
                            setForm({...form, ...p})
                            setStatus('idle')
                        }}
                        onDesktopToggle={(v) => handleDesktopToggle(v)}
                    />
                )
            case 'rendering':
                return contentWrapper(
                    <StreamdownSettingsSection
                        form={{
                            streamdownAssistantEnabled: form.streamdownAssistantEnabled,
                            streamdownUserEnabled: form.streamdownUserEnabled,
                            streamdownSystemEnabled: form.streamdownSystemEnabled,
                            streamdownThinkingEnabled: form.streamdownThinkingEnabled,
                        }}
                        onChange={(p) => {
                            setForm({...form, ...p})
                            setStatus('idle')
                        }}
                    />
                )
            case 'editor':
                return contentWrapper(
                    <EditorSettingsSection
                        editorCommand={form.editorCommand}
                        validationStatus={editorValidationStatus}
                        onChange={(v) => {
                            setForm({...form, editorCommand: v})
                            setStatus('idle')
                        }}
                    />
                )
            case 'git':
                return contentWrapper(
                    <GitDefaultsSection
                        form={{
                            gitUserName: form.gitUserName,
                            gitUserEmail: form.gitUserEmail,
                            branchTemplate: form.branchTemplate,
                        }}
                        onChange={(p) => {
                            setForm({...form, ...p})
                            setStatus('idle')
                        }}
                    />
                )
            case 'github':
                return contentWrapper(
                    <GithubSettingsSection
                        form={{
                            ghAutolinkTickets: form.ghAutolinkTickets,
                            ghPrTitleTemplate: form.ghPrTitleTemplate,
                            ghPrBodyTemplate: form.ghPrBodyTemplate,
                        }}
                        onChange={(p) => {
                            setForm({...form, ...p})
                            setStatus('idle')
                        }}
                    />
                )
            case 'opencode':
                return contentWrapper(
                    <OpencodeAgentSettingsSection
                        form={{opencodePort: form.opencodePort}}
                        onChange={(p) => {
                            setForm({...form, ...p})
                            setStatus('idle')
                        }}
                    />
                )
            case 'oauth':
                return contentWrapper(
                    <GithubOAuthSection
                        form={appCredForm}
                        onChange={(patch: Partial<GithubAppForm>) =>
                            setAppCredForm(appCredForm ? {
                                ...appCredForm,
                                ...patch,
                                secretAction: patch.clientSecret !== undefined ? 'update' : appCredForm.secretAction,
                            } : null)
                        }
                        onClearSecret={(clear: boolean) =>
                            setAppCredForm(appCredForm ? {
                                ...appCredForm,
                                clientSecret: '',
                                secretAction: clear ? 'clear' : 'unchanged',
                            } : null)
                        }
                        dirty={appCredDirty ?? false}
                        saving={saveGithubApp.isPending}
                        onReset={handleOAuthReset}
                        onSave={handleOAuthSave}
                    />
                )
            default:
                return null
        }
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <PageHeader
                title="Application Settings"
                description="Manage global preferences and defaults. Project settings can override some of these values."
                actions={
                    activeSection !== 'oauth' ? (
                        <>
                            {status === 'saved' && (
                                <Badge variant="secondary" className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Saved
                                </Badge>
                            )}
                            {status === 'error' && (
                                <Badge variant="outline" className="border-destructive/60 text-destructive">
                                    Save failed
                                </Badge>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                disabled={!dirty || updateSettings.isPending}
                            >
                                Reset
                            </Button>
                            <Button
                                size="sm"
                                disabled={!dirty || updateSettings.isPending || editorValidationStatus === 'invalid'}
                                onClick={save}
                            >
                                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </>
                    ) : null
                }
            />

            <MasterDetailLayout
                title="Settings"
                items={SETTINGS_ITEMS}
                activeId={activeSection}
                onSelect={(id) => setActiveSection(id as SectionId)}
                loading={isLoading}
            >
                {renderContent()}
            </MasterDetailLayout>
        </div>
    )
}
