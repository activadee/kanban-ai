import {Button} from '@/components/ui/button'
import {FolderOpen} from 'lucide-react'

export function EmptyProjects({onCreate}: { onCreate: () => void }) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center">
            <div className="rounded-full bg-muted/20 p-4">
                <FolderOpen className="size-8 text-muted-foreground"/>
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-medium">No projects yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                    Create your first project to start importing GitHub issues and orchestrating agent runs.
                </p>
            </div>
            <Button onClick={onCreate}>Create Project</Button>
        </div>
    )
}
