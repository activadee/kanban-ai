import {BrowserRouter, Navigate, Outlet, Route, Routes} from 'react-router-dom'
import {useEffect} from 'react'
import {ProjectsPage} from '@/pages/ProjectsPage'
import {ProjectBoardPage} from '@/pages/ProjectBoardPage'
import {ProjectDashboardPage} from '@/pages/ProjectDashboardPage'
import {AgentsPage} from '@/pages/AgentsPage'
import {GitHubIssuesPage} from '@/pages/GitHubIssuesPage'
import {WorktreesPage} from '@/pages/WorktreesPage'
import {AgentSettingsPage} from '@/pages/AgentSettingsPage'
import {DashboardPage} from '@/pages/DashboardPage'
import {AppSettingsPage} from '@/pages/AppSettingsPage'
import {OnboardingPage} from '@/pages/OnboardingPage'
import {AttemptDetailPage} from '@/pages/AttemptDetailPage'
import {AppLayout} from '@/components/layout/AppLayout'
import {QueryClientProvider} from '@tanstack/react-query'
import {ReactQueryDevtools} from '@tanstack/react-query-devtools'
import {queryClient, agentKeys} from '@/lib/queryClient'
import {useOnboardingStatus} from '@/hooks'
import {eventBus} from '@/lib/events'
import {Toaster} from '@/components/ui/toast'
import {AgentCompletionNotifier} from '@/components/notifications/AgentCompletionNotifier'
import {AgentCompletionSoundListener} from '@/components/notifications/AgentCompletionSoundListener'

function RequireOnboardingComplete() {
    const status = useOnboardingStatus()
    if (status.isError) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-destructive">
                Unable to confirm onboarding status.
                <button
                    className="rounded border border-border px-3 py-1 text-foreground"
                    onClick={() => status.refetch()}
                >
                    Retry
                </button>
            </div>
        )
    }
    if (status.isLoading || !status.data) {
        return (
            <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
                Checking onboarding…
            </div>
        )
    }
    if (status.data.status === 'pending') {
        return <Navigate to="/onboarding" replace/>
    }
    return <Outlet/>
}

function App() {
    useEffect(() => {
        const offRegistered = eventBus.on('agent_registered', () => {
            queryClient.invalidateQueries({queryKey: agentKeys.list()})
        })
        const offProfile = eventBus.on('agent_profile', () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
        })
        return () => {
            offRegistered()
            offProfile()
        }
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            <AgentCompletionNotifier/>
            <BrowserRouter>
                <Routes>
                    <Route path="/onboarding" element={<OnboardingPage/>}/>
                    <Route element={<RequireOnboardingComplete/>}>
                        <Route path="/" element={<AppLayout/>}>
                            <Route index element={<ProjectsPage/>}/>
                            <Route path="dashboard" element={<DashboardPage/>}/>
                            <Route path="projects" element={<ProjectsPage/>}/>
                            <Route path="projects/:projectId" element={<ProjectBoardPage/>}/>
                            <Route path="projects/:projectId/dashboard" element={<ProjectDashboardPage/>}/>
                            <Route path="projects/:projectId/agents" element={<AgentsPage/>}/>
                            <Route path="projects/:projectId/github-issues" element={<GitHubIssuesPage/>}/>
                            <Route path="projects/:projectId/worktrees" element={<WorktreesPage/>}/>
                            <Route path="attempts/:attemptId" element={<AttemptDetailPage/>}/>
                            <Route path="agents/:agentKey" element={<AgentSettingsPage/>}/>
                            <Route path="settings" element={<AppSettingsPage/>}/>
                            <Route path="*" element={<Navigate to="/" replace/>}/>
                        </Route>
                    </Route>
                </Routes>
                {null}
                {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false}/> : null}
                <Toaster/>
                <AgentCompletionSoundListener/>
            </BrowserRouter>
        </QueryClientProvider>
    )
}

export default App
