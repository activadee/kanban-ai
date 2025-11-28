import {Folder, Settings2, Trash2} from 'lucide-react'
import type {ProjectSummary} from 'shared'
import {Button} from '@/components/ui/button'
import {useNavigate} from 'react-router-dom'

export function ProjectRow({
                               project,
                               onOpenSettings,
                               onDelete,
                               active,
                           }: {
    project: ProjectSummary
    onOpenSettings: (project: ProjectSummary) => void
    onDelete: (project: ProjectSummary) => void
    active?: boolean
}) {
    const navigate = useNavigate()
    return (
        <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted/70">
            <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}`)}
                aria-current={active}
                className="flex flex-1 items-center gap-2 px-1 text-sm"
            >
                <Folder className="size-4"/>
                <span className="flex-1 truncate text-left font-medium">{project.name}</span>
            </button>
            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={(event) => {
                        event.stopPropagation()
                        onOpenSettings(project)
                    }}
                    title="Project settings"
                >
                    <Settings2 className="size-4"/>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={(event) => {
                        event.stopPropagation()
                        onDelete(project)
                    }}
                    title="Delete project"
                >
                    <Trash2 className="size-4"/>
                </Button>
            </div>
        </div>
    )
}
