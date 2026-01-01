import {Outlet, useNavigate, useLocation} from 'react-router-dom'
import {AppSidebar} from '@/components/layout/AppSidebar'
import {ProjectsNavProvider} from '@/contexts/ProjectsNavContext'
import {useRef, useCallback, useState} from 'react'
import {useIsMobile} from '@/hooks/useIsMobile'
import {Button} from '@/components/ui/button'
import {Menu} from 'lucide-react'

export type AppLayoutContext = {
    registerOpenCreate: (handler: (() => void) | null) => void
    registerCreateTicket: (handler: (() => void) | null) => void
}

export function AppLayout() {
    const openCreateRef = useRef<(() => void) | null>(null)
    const createTicketRef = useRef<(() => void) | null>(null)
    const navigate = useNavigate()
    const location = useLocation()
    const isMobile = useIsMobile()
    const [mobileOpen, setMobileOpen] = useState(false)

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
            <div className="flex h-screen flex-col bg-background text-foreground md:flex-row">
                {isMobile && (
                    <header className="flex h-14 items-center gap-3 border-b border-border/60 bg-muted/20 px-4 md:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="size-5" />
                        </Button>
                        <span className="text-sm font-semibold text-muted-foreground">KanbanAI</span>
                    </header>
                )}
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
                    mobileOpen={mobileOpen}
                    onMobileOpenChange={setMobileOpen}
                />
                <main className="flex-1 overflow-hidden bg-background">
                    <Outlet context={{registerOpenCreate, registerCreateTicket}}/>
                </main>
            </div>
        </ProjectsNavProvider>
    )
}
