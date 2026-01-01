import {ChevronDown, Folder, Plus} from 'lucide-react'
import {useNavigate} from 'react-router-dom'
import type {ProjectSummary} from 'shared'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ProjectSelector({
    projects,
    selectedProjectId,
    onCreateProject,
    collapsed,
}: {
    projects: ProjectSummary[]
    selectedProjectId: string | null
    onCreateProject?: () => void
    collapsed?: boolean
}) {
    const navigate = useNavigate()
    const selectedProject = projects.find((p) => p.id === selectedProjectId)

    const handleSelectProject = (projectId: string) => {
        navigate(`/projects/${projectId}`)
    }

    if (collapsed) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title={selectedProject?.name ?? 'Select project'}
                    >
                        <Folder className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-56">
                    {projects.map((project) => (
                        <DropdownMenuItem
                            key={project.id}
                            onClick={() => handleSelectProject(project.id)}
                            className={cn(
                                project.id === selectedProjectId && 'bg-muted'
                            )}
                        >
                            <Folder className="mr-2 size-4" />
                            <span className="truncate">{project.name}</span>
                        </DropdownMenuItem>
                    ))}
                    {projects.length > 0 && onCreateProject && (
                        <DropdownMenuSeparator />
                    )}
                    {onCreateProject && (
                        <DropdownMenuItem onClick={onCreateProject}>
                            <Plus className="mr-2 size-4" />
                            Create project
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    return (
        <div className="space-y-1 px-3">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm transition hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                        <Folder className="size-4 text-muted-foreground" />
                        <span className="flex-1 truncate text-left font-medium">
                            {selectedProject?.name ?? 'Select project'}
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    {projects.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No projects
                        </div>
                    ) : (
                        projects.map((project) => (
                            <DropdownMenuItem
                                key={project.id}
                                onClick={() => handleSelectProject(project.id)}
                                className={cn(
                                    project.id === selectedProjectId && 'bg-muted'
                                )}
                            >
                                <Folder className="mr-2 size-4" />
                                <span className="truncate">{project.name}</span>
                            </DropdownMenuItem>
                        ))
                    )}
                    {(projects.length > 0 || onCreateProject) && onCreateProject && (
                        <DropdownMenuSeparator />
                    )}
                    {onCreateProject && (
                        <DropdownMenuItem onClick={onCreateProject}>
                            <Plus className="mr-2 size-4" />
                            Create project
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {selectedProject?.repositoryPath && (
                <p className="truncate px-1 text-xs text-muted-foreground" title={selectedProject.repositoryPath}>
                    {selectedProject.repositoryPath}
                </p>
            )}
        </div>
    )
}
