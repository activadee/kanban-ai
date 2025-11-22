import {toast} from '@/components/ui/toast'
//
import {Button} from '@/components/ui/button'
import {useEffect, useMemo, useState} from 'react'
import type {CheckedState} from '@radix-ui/react-checkbox'
import {useAppSettings, useEditors, useUpdateAppSettings} from '@/hooks'
import type {EditorType, UpdateAppSettingsRequest} from 'shared'
import {GeneralSettingsSection} from './app-settings/GeneralSettingsSection'
import {EditorSettingsSection} from './app-settings/EditorSettingsSection'
import {GitDefaultsSection} from './app-settings/GitDefaultsSection'
import {GithubSettingsSection} from './app-settings/GithubSettingsSection'

type FormState = {
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

const SUPPORTED_EDITOR_KEYS: readonly EditorType[] = ['VS_CODE', 'WEBSTORM', 'ZED'] as const

export function AppSettingsPage() {
    const {data, isLoading} = useAppSettings()
    const editorsQuery = useEditors()
    const [form, setForm] = useState<FormState | null>(null)

    const initial = useMemo(() => {
        if (!data) return null
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
        } satisfies FormState
    }, [data])

    useEffect(() => {
        if (initial && !form) setForm(initial)
    }, [initial, form])

    const dirty = form && initial && JSON.stringify(form) !== JSON.stringify(initial)

    const updateSettings = useUpdateAppSettings({
        onSuccess: (result) => {
            toast({title: 'Settings saved', variant: 'success'})
            const next: FormState = {
                theme: result.theme,
                language: result.language,
                telemetryEnabled: result.telemetryEnabled,
                notificationsAgentCompletionSound: result.notificationsAgentCompletionSound,
                notificationsDesktop: result.notificationsDesktop,
                editorType: result.editorType,
                gitUserName: result.gitUserName ?? '',
                gitUserEmail: result.gitUserEmail ?? '',
                branchTemplate: result.branchTemplate,
                ghPrTitleTemplate: result.ghPrTitleTemplate ?? '',
                ghPrBodyTemplate: result.ghPrBodyTemplate ?? '',
                ghAutolinkTickets: result.ghAutolinkTickets,
            }
            setForm(next)
        },
        onError: (err) => {
            toast({title: 'Save failed', description: err.message, variant: 'destructive'})
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
            editorType: form.editorType || undefined,
            gitUserName: form.gitUserName.trim() || null,
            gitUserEmail: form.gitUserEmail.trim() || null,
            branchTemplate: form.branchTemplate,
            ghPrTitleTemplate: form.ghPrTitleTemplate.trim() || null,
            ghPrBodyTemplate: form.ghPrBodyTemplate.trim() || null,
            ghAutolinkTickets: form.ghAutolinkTickets,
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

    const installedEditors = useMemo(
        () =>
            (editorsQuery.data ?? []).filter((editor) => editor.installed && SUPPORTED_EDITOR_KEYS.includes(editor.key as EditorType)),
        [editorsQuery.data],
    )

    useEffect(() => {
        setForm((prev) => {
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

    if (isLoading && !data) {
        return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading
            settings…</div>
    }

    if (data && !form) setForm(initial)

    return (
        <div className="flex h-full flex-col overflow-auto bg-background px-8 py-6">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Application Settings</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Manage global preferences and defaults. Project
                        settings can override some of these values.</p>
                </div>

                {form && (
                    <>
                        <div className="divide-y rounded-md border">
                            <GeneralSettingsSection form={form} onChange={(p) => setForm({...form, ...p})}
                                                    onDesktopToggle={(v) => handleDesktopToggle(v)}/>
                            <EditorSettingsSection editorType={form.editorType}
                                                   installed={installedEditors as { key: EditorType; label: string }[]}
                                                   onChange={(v) => setForm({...form, editorType: v})}/>
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
                        </div>
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
                    <Button disabled={!dirty || updateSettings.isPending} onClick={save}>
                        {updateSettings.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
