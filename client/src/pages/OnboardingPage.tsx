import {Loader2, Check, ArrowLeft, ArrowRight, Rocket} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {useOnboardingState, STEP_META, STEP_ORDER} from './OnboardingPage/useOnboardingState'
import {IntroStep} from './OnboardingPage/steps/IntroStep'
import {SettingsStep} from './OnboardingPage/steps/SettingsStep'
import {EditorStep} from './OnboardingPage/steps/EditorStep'
import {GitStep} from './OnboardingPage/steps/GitStep'
import {GithubDeviceFlowStep} from './OnboardingPage/steps/GithubDeviceFlowStep'
import {SummaryStep} from './OnboardingPage/steps/SummaryStep'

export function OnboardingPage() {
    const {state, actions} = useOnboardingState()

    if (state.queryErrored) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-center text-sm text-destructive">
                <div>Could not load onboarding prerequisites.</div>
                {state.queryErrorMessages.length ? (
                    <div className="text-xs text-muted-foreground">
                        {state.queryErrorMessages.join(' · ')}
                    </div>
                ) : null}
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={actions.retryPrerequisites}>
                        Retry
                    </Button>
                </div>
            </div>
        )
    }

    if (state.isInitializing) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin"/>
                Preparing onboarding…
            </div>
        )
    }

    if (state.onboardingStatusError) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-sm text-destructive">
                Unable to load onboarding status. Please retry.
            </div>
        )
    }

    const stepId = state.stepId
    const stepMeta = state.stepMeta
    const currentStep = state.stepIndex
    const stepCount = state.stepCount
    const settingsForm = state.settingsForm!

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
                            {state.onboardingCompleted ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    You previously completed onboarding. You can revisit steps and save updates here.
                                </p>
                            ) : null}
                        </div>
                        <Badge variant="secondary">{currentStep + 1} / {stepCount}</Badge>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-5xl px-6 py-8">
                    <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
                        {stepId === 'welcome' ? (
                            <IntroStep appCredForm={state.appCredForm} setAppCredForm={actions.setAppCredForm}/>
                        ) : null}

                        {stepId === 'general' ? (
                            <SettingsStep
                                settingsForm={settingsForm}
                                onChange={(patch) =>
                                    actions.setSettingsForm((prev) => (prev ? {...prev, ...patch} : prev))
                                }
                                onDesktopToggle={(checked) => actions.handleDesktopToggle(checked)}
                            />
                        ) : null}

                        {stepId === 'editor' ? (
                            <EditorStep
                                settingsForm={settingsForm}
                                installedEditors={state.installedEditors}
                                onChange={(patch) =>
                                    actions.setSettingsForm((prev) => (prev ? {...prev, ...patch} : prev))
                                }
                            />
                        ) : null}

                        {stepId === 'github-app' ? (
                            <GitStep
                                settingsForm={settingsForm}
                                appCredForm={state.appCredForm}
                                setSettingsForm={(patch) =>
                                    actions.setSettingsForm((prev) => (prev ? {...prev, ...patch} : prev))
                                }
                                setAppCredForm={actions.setAppCredForm}
                                savingAppConfig={state.saveGithubAppPending}
                            />
                        ) : null}

                        {stepId === 'github-connect' ? (
                            <GithubDeviceFlowStep
                                connected={state.connected}
                                connectedUsername={state.connectedUsername}
                                githubConfigMissingId={state.githubConfigMissingId}
                                deviceState={state.deviceState}
                                startingDevice={state.startingDevice}
                                polling={state.polling}
                                githubAuthRefreshing={state.githubAuthRefreshing}
                                onRefreshStatus={actions.refreshGithubStatus}
                                onStartConnect={actions.startGithubConnect}
                            />
                        ) : null}

                        {stepId === 'finish' ? (
                            <SummaryStep connected={state.connected}/>
                        ) : null}
                    </div>

                    <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Step {currentStep + 1} of {stepCount}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                disabled={currentStep === 0 || state.completePending}
                                onClick={() => {
                                    void actions.goBack()
                                }}
                            >
                                <ArrowLeft className="mr-1 size-4"/>Back
                            </Button>
                            <Button
                                variant="outline"
                                disabled={state.saveSettingsPending || state.saveGithubAppPending}
                                onClick={() => {
                                    void actions.saveProgress()
                                }}
                            >
                                Save progress
                            </Button>
                            <Button
                                onClick={() => {
                                    void actions.goNext()
                                }}
                                disabled={
                                    state.completePending ||
                                    state.startingDevice ||
                                    (stepId === 'github-app' && !state.appCredForm?.clientId.trim())
                                }
                            >
                                {stepId === 'finish'
                                    ? state.completePending
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
