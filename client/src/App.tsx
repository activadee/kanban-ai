import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom'
import {useEffect} from 'react'
import {ProjectsPage} from '@/pages/ProjectsPage'
import {ProjectBoardPage} from '@/pages/ProjectBoardPage'
import {AgentSettingsPage} from '@/pages/AgentSettingsPage'
import {DashboardPage} from '@/pages/DashboardPage'
import {AppSettingsPage} from '@/pages/AppSettingsPage'
import {AppLayout} from '@/components/layout/AppLayout'
import {QueryClientProvider} from '@tanstack/react-query'
import {ReactQueryDevtools} from '@tanstack/react-query-devtools'
import {queryClient, agentKeys} from '@/lib/queryClient'
import {eventBus} from '@/lib/events'
import {Toaster} from '@/components/ui/toast'
import {AgentCompletionNotifier} from '@/components/notifications/AgentCompletionNotifier'
import {AgentCompletionSoundListener} from '@/components/notifications/AgentCompletionSoundListener'

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
            <BrowserRouter basename="/app">
                <Routes>
                    <Route path="/" element={<AppLayout/>}>
                        <Route index element={<ProjectsPage/>}/>
                        <Route path="dashboard" element={<DashboardPage/>}/>
                        <Route path="projects" element={<ProjectsPage/>}/>
                        <Route path="projects/:projectId" element={<ProjectBoardPage/>}/>
                        <Route path="agents/:agentKey" element={<AgentSettingsPage/>}/>
                        <Route path="settings" element={<AppSettingsPage/>}/>
                        <Route path="*" element={<Navigate to="/" replace/>}/>
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
