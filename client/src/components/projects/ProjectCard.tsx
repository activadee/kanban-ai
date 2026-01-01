import {Card, CardContent, CardHeader} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {ArrowRight, EllipsisVertical, GitBranch, Pencil, Trash2} from 'lucide-react'
import type {ProjectSummary} from 'shared'
import {cn} from '@/lib/utils'

export type Project = ProjectSummary

type ProjectCardProps = {
    project: Project
    onOpen: (projectId: string) => void
    onEdit: (project: Project) => void
    onDelete: (project: Project) => void
    className?: string
    style?: React.CSSProperties
}

export function ProjectCard({project, onOpen, onEdit, onDelete, className, style}: ProjectCardProps) {
    const createdLabel = (() => {
        const date = new Date(project.createdAt)
        return Number.isNaN(date.getTime()) ? project.createdAt : date.toLocaleDateString()
    })()

    const isActive = project.status === 'Active'

    return (
        <Card
            className={cn(
                'group relative overflow-hidden',
                'border-border/50 bg-card/80',
                'transition-all duration-200 ease-out',
                'hover:border-border hover:bg-card hover:shadow-lg hover:shadow-brand/5',
                'dark:bg-card/60 dark:hover:bg-card/90',
                className
            )}
            style={style}
        >
            <div
                className="pointer-events-none absolute -inset-px rounded-[inherit] bg-gradient-to-br from-brand/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-2 pt-4">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'size-2 rounded-full',
                            isActive
                                ? 'bg-brand shadow-[0_0_8px_2px] shadow-brand/40'
                                : 'bg-muted-foreground/40'
                        )}
                    />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {project.status}
                    </span>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label={`Project ${project.name} menu`}
                        >
                            <EllipsisVertical className="size-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onOpen(project.id)}>
                            <ArrowRight className="mr-2 size-4"/>
                            Open board
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(project)}>
                            <Pencil className="mr-2 size-4"/>
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(project)}
                        >
                            <Trash2 className="mr-2 size-4"/>
                            Delete...
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>

            <CardContent className="relative flex flex-col gap-4 pb-4">
                <div className="space-y-1">
                    <h3 className="line-clamp-1 text-lg font-semibold text-foreground">
                        {project.name}
                    </h3>
                    {project.repositorySlug && (
                        <p className="line-clamp-1 font-mono text-sm text-muted-foreground/80">
                            {project.repositorySlug}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <GitBranch className="size-3"/>
                        Git workspace
                    </span>
                    <span className="text-border/60">|</span>
                    <span>Created {createdLabel}</span>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                    <span className="truncate text-xs text-muted-foreground/70 max-w-[60%]">
                        {project.repositoryPath}
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs font-medium group-hover:bg-accent"
                        onClick={() => onOpen(project.id)}
                    >
                        Open Board
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5"/>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
