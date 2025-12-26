import {useMemo, useState} from 'react'
import {useLocation, useNavigate, useParams} from 'react-router-dom'
import {LayoutDashboard, Kanban, Settings, RefreshCw, Plus, PanelLeftClose, PanelRight} from 'lucide-react'
import {useProjectsNav} from '@/contexts/useProjectsNav'
import {Button} from '@/components/ui/button'
//
import {cn} from '@/lib/utils'
import {ProjectSettingsDrawer} from '@/components/projects/ProjectSettingsDrawer'
import {ProjectDeleteDialog} from '@/components/projects/ProjectDeleteDialog'
import type {ProjectSummary} from 'shared'
//
import {useAgents} from '@/hooks'
import {NavButton} from './sidebar/NavButton'
import {AgentsSection} from './sidebar/AgentsSection'
import {GitHubAccountBox} from './sidebar/GitHubAccountBox'
import {ProjectsList} from './sidebar/ProjectsList'
import {describeApiError} from '@/api/http'
import {useLocalStorage} from '@/hooks/useLocalStorage'

// NavButton moved to './sidebar/NavButton'

export function AppSidebar({onCreateProject}: { onCreateProject?: () => void }) {
    const navigate = useNavigate()
    const location = useLocation()
    const params = useParams<{ projectId: string }>()
    const {projects, loading, refresh, deleteMutation} = useProjectsNav()
    // collapsed state now handled inside ProjectsList
    const [settingsProject, setSettingsProject] = useState<ProjectSummary | null>(null)
    const [deleteProject, setDeleteProject] = useState<ProjectSummary | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // Persist sidebar collapsed state in localStorage
    const [isCollapsed, setIsCollapsed] = useLocalStorage('app-sidebar-collapsed', false)

    const activeProjectId = params.projectId ?? null

    const groupedProjects = useMemo(() => projects, [projects])
    const agentsQuery = useAgents()

    const toggleSidebar = () => {
        setIsCollapsed((prev: boolean) => !prev)
    }

    return (
        <aside
            className={cn(
                'flex h-full flex-col border-r border-border/60 bg-muted/20 transition-all duration-300 ease-in-out',
                isCollapsed ? 'w-16' : 'w-64'
            )}
            aria-expanded={!isCollapsed}
        >
            {/* Header with toggle button and branding */}
            <div className={cn('flex items-center px-3 py-4', isCollapsed ? 'justify-center gap-2' : 'justify-between')}>
                {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">KanbanAI</span>
                    </div>
                )}
                <div className={cn('flex items-center', isCollapsed ? 'gap-1' : '')}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-7 transition-transform duration-200', isCollapsed ? '' : 'order-last')}
                        onClick={toggleSidebar}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-expanded={!isCollapsed}
                    >
                        {isCollapsed ? (
                            <PanelRight className="size-4"/>
                        ) : (
                            <PanelLeftClose className="size-4"/>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={refresh}
                        title="Refresh projects"
                        disabled={loading}
                    >
                        <RefreshCw className={cn('size-4', loading && 'animate-spin')}/>
                    </Button>
                </div>
            </div>

            {/* Collapsed state - show only icons */}
            {isCollapsed ? (
                <div className="flex flex-col items-center gap-2 px-2 py-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => navigate('/dashboard')}
                        title="Dashboard"
                        aria-label="Dashboard"
                    >
                        <LayoutDashboard className="size-5"/>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => navigate('/')}
                        title="Projects"
                        aria-label="Projects"
                    >
                        <Kanban className="size-5"/>
                    </Button>
                    <div className="h-px w-8 bg-border/60 my-1"/>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onCreateProject?.()}
                        title="Create project"
                        aria-label="Create project"
                    >
                        <Plus className="size-5"/>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => navigate('/settings')}
                        title="Settings"
                        aria-label="Settings"
                    >
                        <Settings className="size-5"/>
                    </Button>
                    <div className="mt-auto h-px w-8 bg-border/60 my-1"/>
                    <GitHubAccountBox collapsed={true}/>
                </div>
            ) : (
                /* Expanded state - full sidebar content */
                <>
                    <div className="space-y-1">
                        <NavButton
                            icon={LayoutDashboard}
                            label="Dashboard"
                            active={location.pathname === '/dashboard'}
                            onClick={() => navigate('/dashboard')}
                        />
                        <NavButton
                            icon={Kanban}
                            label="Projects"
                            active={location.pathname === '/' || location.pathname === '/projects'}
                            onClick={() => navigate('/')}
                        />
                    </div>

                    <div className="my-4 h-px bg-border/60"/>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 ml-auto"
                            onClick={() => onCreateProject?.()}
                            title="Create project"
                        >
                            <Plus className="size-4"/>
                        </Button>
                    </div>
                    <ProjectsList
                        projects={groupedProjects}
                        activeProjectId={activeProjectId}
                        loading={loading}
                        onOpenSettings={(p) => setSettingsProject(p)}
                        onDelete={(p) => {
                            setDeleteProject(p);
                            setDeleteError(null)
                        }}
                    />

                    {/* Agents section */}
                    <div className="my-4 h-px bg-border/60"/>
                    <AgentsSection agents={agentsQuery.data?.agents ?? []}/>

                    {/* GitHub account */}
                    <div className="mt-auto space-y-3 pt-4">
                        <GitHubAccountBox/>
                        <div className="h-px bg-border/60"/>

                        {/* App settings entry */}
                        <NavButton
                            icon={Settings}
                            label="Settings"
                            active={location.pathname.startsWith('/settings')}
                            onClick={() => navigate('/settings')}
                        />
                    </div>
                </>
            )}

            <ProjectSettingsDrawer
                projectId={settingsProject?.id ?? null}
                open={Boolean(settingsProject)}
                onOpenChange={(open) => {
                    if (!open) setSettingsProject(null)
                }}
            />
            <ProjectDeleteDialog
                open={Boolean(deleteProject)}
                project={deleteProject}
                loading={deleteLoading}
                errorMessage={deleteError}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteProject(null)
                        setDeleteError(null)
                        setDeleteLoading(false)
                    }
                }}
                onConfirm={async () => {
                    if (!deleteProject) return
                    setDeleteLoading(true)
                    try {
                        await deleteMutation.mutateAsync(deleteProject.id)
                        setDeleteProject(null)
                        setDeleteError(null)
                    } catch (err) {
                        console.error('sidebar delete project failed', err)
                        const {description} = describeApiError(err, 'Unable to delete project. Please try again.')
                        setDeleteError(description || 'Unable to delete project. Please try again.')
                    } finally {
                        setDeleteLoading(false)
                    }
                }}
            />
        </aside>
    )
}

// AgentsSection and GitHubAccountBox moved to './sidebar'
