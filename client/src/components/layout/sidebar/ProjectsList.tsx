import {useState} from 'react'
import {ChevronDown, ChevronRight} from 'lucide-react'
import type {ProjectSummary} from 'shared'
import {ScrollArea} from '@/components/ui/scroll-area'
import {ProjectRow} from './ProjectRow'

export function ProjectsList({
                                 projects,
                                 activeProjectId,
                                 loading,
                                 onOpenSettings,
                                 onDelete,
                             }: {
    projects: ProjectSummary[]
    activeProjectId: string | null
    loading?: boolean
    onOpenSettings: (p: ProjectSummary) => void
    onDelete: (p: ProjectSummary) => void
}) {
    const [open, setOpen] = useState(true)
    return (
        <div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    aria-expanded={open}
                    className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                    {open ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}
                    <span className="flex-1 text-left">Projects</span>
                </button>
            </div>
            {open ? (
                <ScrollArea className="mt-2 max-h-64 pr-1">
                    <div className="space-y-1">
                        {loading ? (
                            <div
                                className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Loading…</div>
                        ) : projects.length === 0 ? (
                            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">No
                                projects</div>
                        ) : (
                            projects.map((project) => (
                                <ProjectRow
                                    key={project.id}
                                    project={project}
                                    active={project.id === activeProjectId}
                                    onOpenSettings={onOpenSettings}
                                    onDelete={onDelete}
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>
            ) : null}
        </div>
    )
}
