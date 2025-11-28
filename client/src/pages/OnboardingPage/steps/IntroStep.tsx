import type {Dispatch, SetStateAction} from 'react'
import {GitHubIcon} from '@/components/icons/SimpleIcons'
import type {CredentialsState} from '../useOnboardingState'

export function IntroStep({appCredForm, setAppCredForm}: {
    appCredForm: CredentialsState | null
    setAppCredForm: Dispatch<SetStateAction<CredentialsState | null>>
}) {
    return (
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
            {appCredForm ? (
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
            ) : null}
        </div>
    )
}

