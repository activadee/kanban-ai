import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {EllipsisVertical, Pencil, SquareArrowOutUpRight, Trash2} from 'lucide-react'
import type {ProjectSummary} from 'shared'

export type Project = ProjectSummary

type ProjectCardProps = {
    project: Project
    onOpen: (projectId: string) => void
    onEdit: (project: Project) => void
    onDelete: (project: Project) => void
}

export function ProjectCard({project, onOpen, onEdit, onDelete}: ProjectCardProps) {
    const createdLabel = (() => {
        const date = new Date(project.createdAt)
        return Number.isNaN(date.getTime()) ? project.createdAt : date.toLocaleDateString()
    })()

    return (
        <Card className="bg-muted/20 border-border/40">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold text-foreground">
                        {project.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="block size-1.5 rounded-full bg-primary"/>
                {project.status}
            </span>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground"
                                aria-label={`Project ${project.name} menu`}>
                            <EllipsisVertical className="size-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onOpen(project.id)}>
                            <SquareArrowOutUpRight className="mr-2 size-4"/>
                            Open board
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(project)}>
                            <Pencil className="mr-2 size-4"/>
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem className="text-destructive focus:text-destructive"
                                          onClick={() => onDelete(project)}>
                            <Trash2 className="mr-2 size-4"/>
                            Delete…
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            Created {createdLabel}
                        </Badge>
                        <Badge variant="outline" className="border-border/60 text-foreground/80">
                            Git workspace
                        </Badge>
                    </div>
                    <span className="truncate text-xs">
            {project.repositorySlug ?? project.repositoryPath}
          </span>
                </div>
                <Button size="sm" onClick={() => onOpen(project.id)}>
                    Open Board
                </Button>
            </CardContent>
        </Card>
    )
}
