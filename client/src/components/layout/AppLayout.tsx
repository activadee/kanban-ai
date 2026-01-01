import {Outlet, useNavigate, useLocation} from 'react-router-dom'
import {AppSidebar} from '@/components/layout/AppSidebar'
import {ProjectsNavProvider} from '@/contexts/ProjectsNavContext'
import {useRef, useCallback} from 'react'

export type AppLayoutContext = {
    registerOpenCreate: (handler: (() => void) | null) => void
    registerCreateTicket: (handler: (() => void) | null) => void
}

export function AppLayout() {
    const openCreateRef = useRef<(() => void) | null>(null)
    const createTicketRef = useRef<(() => void) | null>(null)
    const navigate = useNavigate()
    const location = useLocation()

    const registerOpenCreate = (handler: (() => void) | null) => {
        openCreateRef.current = handler
    }

    const registerCreateTicket = useCallback((handler: (() => void) | null) => {
        createTicketRef.current = handler
    }, [])

    const triggerCreate = () => {
        const handler = openCreateRef.current
        if (!handler) return
        handler()
    }

    const triggerCreateTicket = useCallback(() => {
        const handler = createTicketRef.current
        if (!handler) return
        handler()
    }, [])

    return (
        <ProjectsNavProvider>
            <div className="flex h-screen bg-background text-foreground">
                <AppSidebar
                    onCreateProject={() => {
                        if (location.pathname !== '/') {
                            navigate('/')
                            setTimeout(triggerCreate, 50)
                        } else {
                            triggerCreate()
                        }
                    }}
                    onCreateTicket={triggerCreateTicket}
                />
                <main className="flex-1 overflow-hidden bg-background">
                    <Outlet context={{registerOpenCreate, registerCreateTicket}}/>
                </main>
            </div>
        </ProjectsNavProvider>
    )
}
