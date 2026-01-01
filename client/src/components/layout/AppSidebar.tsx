import {useMemo, useState} from 'react'
import {useLocation, useNavigate, useParams} from 'react-router-dom'
import {
    LayoutDashboard,
    Kanban,
    Settings,
    RefreshCw,
    Plus,
    PanelLeftClose,
    PanelRight,
    Bot,
    GitPullRequestDraft,
    GitBranch,
    HelpCircle,
} from 'lucide-react'
import {useProjectsNav} from '@/contexts/useProjectsNav'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'
import {ProjectSettingsDrawer} from '@/components/projects/ProjectSettingsDrawer'
import {ProjectDeleteDialog} from '@/components/projects/ProjectDeleteDialog'
import type {ProjectSummary} from 'shared'
import {NavButton} from './sidebar/NavButton'
import {GitHubAccountBox} from './sidebar/GitHubAccountBox'
import {ProjectSelector} from './sidebar/ProjectSelector'
import {SectionLabel} from './sidebar/SectionLabel'
import {describeApiError} from '@/api/http'
import {useLocalStorage} from '@/hooks/useLocalStorage'
import {useKeyboardShortcuts} from '@/hooks/useKeyboardShortcuts'

export function AppSidebar({
    onCreateProject,
    onCreateTicket,
}: {
    onCreateProject?: () => void
    onCreateTicket?: () => void
}) {
    const navigate = useNavigate()
    const location = useLocation()
    const params = useParams<{projectId: string}>()
    const {projects, loading, refresh, deleteMutation} = useProjectsNav()
    const [settingsProject, setSettingsProject] = useState<ProjectSummary | null>(null)
    const [deleteProject, setDeleteProject] = useState<ProjectSummary | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const [isCollapsed, setIsCollapsed] = useLocalStorage('app-sidebar-collapsed', false)

    const activeProjectId = params.projectId ?? null
    const hasActiveProject = Boolean(activeProjectId)

    const groupedProjects = useMemo(() => projects, [projects])

    useKeyboardShortcuts()

    const toggleSidebar = () => {
        setIsCollapsed((prev: boolean) => !prev)
    }

    const isProjectRoute = (path: string) => {
        if (!activeProjectId) return false
        return location.pathname === `/projects/${activeProjectId}${path}`
    }

    const navigateToProjectRoute = (path: string) => {
        if (!activeProjectId) return
        navigate(`/projects/${activeProjectId}${path}`)
    }

    return (
        <aside
            className={cn(
                'flex h-full flex-col border-r border-border/60 bg-muted/20 transition-all duration-300 ease-in-out',
                isCollapsed ? 'w-16' : 'w-64'
            )}
            aria-expanded={!isCollapsed}
        >
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
                            <PanelRight className="size-4" />
                        ) : (
                            <PanelLeftClose className="size-4" />
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
                        <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                    </Button>
                </div>
            </div>

            {isCollapsed ? (
                <div className="flex flex-1 flex-col items-center gap-2 px-2 py-4">
                    <ProjectSelector
                        projects={groupedProjects}
                        selectedProjectId={activeProjectId}
                        onCreateProject={onCreateProject}
                        collapsed
                    />
                    <div className="h-px w-8 bg-border/60 my-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-8', isProjectRoute('/dashboard') && 'bg-muted')}
                        onClick={() => navigateToProjectRoute('/dashboard')}
                        title="Dashboard (D)"
                        aria-label="Dashboard"
                        disabled={!hasActiveProject}
                    >
                        <LayoutDashboard className="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-8', isProjectRoute('') && 'bg-muted')}
                        onClick={() => navigateToProjectRoute('')}
                        title="Kanban Board (K)"
                        aria-label="Kanban Board"
                        disabled={!hasActiveProject}
                    >
                        <Kanban className="size-5" />
                    </Button>
                    
                    <div className="h-px w-8 bg-border/60 my-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-8', location.pathname === '/agents' && 'bg-muted')}
                        onClick={() => navigate('/agents')}
                        title="Agents (A)"
                        aria-label="Agents"
                    >
                        <Bot className="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-8', isProjectRoute('/github-issues') && 'bg-muted')}
                        onClick={() => navigateToProjectRoute('/github-issues')}
                        title="GitHub Issues (G)"
                        aria-label="GitHub Issues"
                        disabled={!hasActiveProject}
                    >
                        <GitPullRequestDraft className="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('size-8', isProjectRoute('/worktrees') && 'bg-muted')}
                        onClick={() => navigateToProjectRoute('/worktrees')}
                        title="Worktrees (W)"
                        aria-label="Worktrees"
                        disabled={!hasActiveProject}
                    >
                        <GitBranch className="size-5" />
                    </Button>

                    <div className="flex-1" />

                    {onCreateTicket && hasActiveProject && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={onCreateTicket}
                            title="Create Ticket"
                            aria-label="Create Ticket"
                        >
                            <Plus className="size-5" />
                        </Button>
                    )}

                    <div className="h-px w-8 bg-border/60 my-1" />
                    <GitHubAccountBox collapsed />
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => navigate('/settings')}
                            title="Settings"
                            aria-label="Settings"
                        >
                            <Settings className="size-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Help"
                            aria-label="Help"
                        >
                            <HelpCircle className="size-5" />
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <ProjectSelector
                        projects={groupedProjects}
                        selectedProjectId={activeProjectId}
                        onCreateProject={onCreateProject}
                    />

                    <div className="my-4 h-px bg-border/60" />

                    <SectionLabel>Project</SectionLabel>
                    <div className="space-y-1">
                        <NavButton
                            icon={LayoutDashboard}
                            label="Dashboard"
                            shortcut="D"
                            active={isProjectRoute('/dashboard')}
                            onClick={() => navigateToProjectRoute('/dashboard')}
                        />
                        <NavButton
                            icon={Kanban}
                            label="Kanban Board"
                            shortcut="K"
                            active={isProjectRoute('')}
                            onClick={() => navigateToProjectRoute('')}
                        />
                    </div>

                    <div className="my-4 h-px bg-border/60" />

                    <SectionLabel>Tools</SectionLabel>
                    <div className="space-y-1">
                        <NavButton
                            icon={Bot}
                            label="Agents"
                            shortcut="A"
                            active={location.pathname === '/agents'}
                            onClick={() => navigate('/agents')}
                        />
                        <NavButton
                            icon={GitPullRequestDraft}
                            label="GitHub Issues"
                            shortcut="G"
                            active={isProjectRoute('/github-issues')}
                            onClick={() => navigateToProjectRoute('/github-issues')}
                        />
                        <NavButton
                            icon={GitBranch}
                            label="Worktrees"
                            shortcut="W"
                            active={isProjectRoute('/worktrees')}
                            onClick={() => navigateToProjectRoute('/worktrees')}
                        />
                    </div>

                    <div className="mt-auto space-y-3 pt-4">
                        {onCreateTicket && hasActiveProject && (
                            <div className="px-3">
                                <Button
                                    className="w-full"
                                    onClick={onCreateTicket}
                                >
                                    <Plus className="mr-2 size-4" />
                                    Create Ticket
                                </Button>
                            </div>
                        )}

                        <GitHubAccountBox />
                        <div className="h-px bg-border/60" />

                        <div className="flex items-center gap-1">
                            <NavButton
                                icon={Settings}
                                label="Settings"
                                active={location.pathname.startsWith('/settings')}
                                onClick={() => navigate('/settings')}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 shrink-0"
                                title="Help"
                                aria-label="Help"
                            >
                                <HelpCircle className="size-4" />
                            </Button>
                        </div>
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
