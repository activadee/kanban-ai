import {toast} from '@/components/ui/toast'
import {Button} from '@/components/ui/button'
import {useEffect, useMemo, useState} from 'react'
import type {CheckedState} from '@radix-ui/react-checkbox'
import {useAppSettings, useGithubAppConfig, useSaveGithubAppConfig, useUpdateAppSettings, useValidateEditorPath} from '@/hooks'
import type {GithubAppConfig, UpdateAppSettingsRequest} from 'shared'
import {GeneralSettingsSection} from './app-settings/GeneralSettingsSection'
import {EditorSettingsSection} from './app-settings/EditorSettingsSection'
import {GitDefaultsSection} from './app-settings/GitDefaultsSection'
import {GithubSettingsSection} from './app-settings/GithubSettingsSection'
import {OpencodeAgentSettingsSection} from './app-settings/OpencodeAgentSettingsSection'
import {GithubAppCredentialsFields} from '@/components/github/GithubAppCredentialsFields'
import {describeApiError} from '@/api/http'
import {PageHeader} from '@/components/layout/PageHeader'

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
}

type GithubAppForm = {
    clientId: string
    clientSecret: string
    hasClientSecret: boolean
    secretAction: 'unchanged' | 'update' | 'clear'
    source: GithubAppConfig['source']
    updatedAt: string | null
}

export function AppSettingsPage() {
    const {data, isLoading} = useAppSettings()
    const validateEditor = useValidateEditorPath()
    const githubAppQuery = useGithubAppConfig()
    const [form, setForm] = useState<FormState | null>(null)
    const [editorValidationStatus, setEditorValidationStatus] = useState<'valid' | 'invalid' | 'pending' | null>(null)
    const [appCredForm, setAppCredForm] = useState<GithubAppForm | null>(null)
    const [appCredInitial, setAppCredInitial] = useState<GithubAppForm | null>(null)

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
            }
            setForm(next)
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Save failed')
            toast({title, description, variant: 'destructive'})
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

    if (isLoading && !data) {
        return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading settings…</div>
    }

    if (data && !form) setForm(initial)

    return (
        <div className="flex h-full flex-col overflow-auto bg-background">
            <PageHeader
                title="Application Settings"
                description="Manage global preferences and defaults. Project settings can override some of these values."
                containerClassName="max-w-5xl"
            />

            <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

                {form && (
                    <>
                        <div className="divide-y rounded-md border">
                            <GeneralSettingsSection form={form} onChange={(p) => setForm({...form, ...p})}
                                                    onDesktopToggle={(v) => handleDesktopToggle(v)}/>
                            <EditorSettingsSection editorCommand={form.editorCommand}
                                                   validationStatus={editorValidationStatus}
                                                   onChange={(v) => setForm({...form, editorCommand: v})}/>
                            <GitDefaultsSection form={{
                                gitUserName: form.gitUserName,
                                gitUserEmail: form.gitUserEmail,
                                branchTemplate: form.branchTemplate
                            }} onChange={(p) => setForm({...form, ...p})}/>
                            <GithubSettingsSection form={{
                                ghAutolinkTickets: form.ghAutolinkTickets,
                                ghPrTitleTemplate: form.ghPrTitleTemplate,
                                ghPrBodyTemplate: form.ghPrBodyTemplate
                            }} onChange={(p) => setForm({...form, ...p})}/>
                            <OpencodeAgentSettingsSection form={{opencodePort: form.opencodePort}}
                                                           onChange={(p) => setForm({...form, ...p})}/>
                        </div>
                        {appCredForm ? (
                            <div className="rounded-md border p-6">
                                <div className="mb-4">
                                    <h2 className="text-base font-medium">GitHub OAuth App</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Client ID and secret used for GitHub device flow. Values are stored locally in the app database.
                                    </p>
                                </div>
                                <GithubAppCredentialsFields
                                    value={appCredForm}
                                    onChange={(patch) =>
                                        setAppCredForm({
                                            ...appCredForm,
                                            ...patch,
                                            secretAction: patch.clientSecret !== undefined ? 'update' : appCredForm.secretAction,
                                        })
                                    }
                                    disabled={saveGithubApp.isPending}
                                />
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="rounded border-border"
                                            checked={appCredForm.secretAction === 'clear'}
                                            onChange={(e) =>
                                                setAppCredForm({
                                                    ...appCredForm,
                                                    clientSecret: '',
                                                    secretAction: e.target.checked ? 'clear' : 'unchanged',
                                                })
                                            }
                                        />
                                        Remove stored secret (fall back to env)
                                    </label>
                                </div>
                                <div className="mt-4 flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        disabled={!appCredDirty || saveGithubApp.isPending}
                                        onClick={() => {
                                            if (appCredInitial) setAppCredForm(appCredInitial)
                                        }}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        disabled={
                                            !appCredDirty ||
                                            saveGithubApp.isPending ||
                                            !appCredForm.clientId.trim()
                                        }
                                        onClick={() => saveGithubApp.mutate({
                                            clientId: appCredForm.clientId.trim(),
                                            clientSecret:
                                                appCredForm.secretAction === 'unchanged'
                                                    ? undefined
                                                    : appCredForm.secretAction === 'clear'
                                                        ? null
                                                        : appCredForm.clientSecret.trim() || null,
                                        })}
                                    >
                                        {saveGithubApp.isPending ? 'Saving…' : 'Save GitHub app'}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </>
                )}

                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        disabled={!dirty || updateSettings.isPending}
                        onClick={() => {
                            if (initial) setForm(initial)
                        }}
                    >
                        Reset
                    </Button>
                    <Button disabled={!dirty || updateSettings.isPending || editorValidationStatus === 'invalid'} onClick={save}>
                        {updateSettings.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
