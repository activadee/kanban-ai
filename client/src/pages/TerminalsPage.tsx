import {useParams} from 'react-router-dom'
import {Terminal, FolderOpen, Sparkles} from 'lucide-react'
import {PageHeader} from '@/components/layout/PageHeader'
import {TerminalsToolWindow} from '@/components/Terminal'

export function TerminalsPage() {
    const {projectId} = useParams<{projectId: string}>()

    if (!projectId) {
        return (
            <div className="flex h-full flex-col overflow-hidden bg-background">
                <PageHeader
                    title="Terminals"
                    description="Interactive shell sessions for your active worktrees."
                />
                <div className="flex flex-1 items-center justify-center p-8">
                    <div className="relative flex max-w-md flex-col items-center gap-6 text-center">
                        <div className="absolute -inset-20 -z-10 rounded-full bg-gradient-to-br from-brand/5 via-transparent to-muted/10 blur-3xl" />
                        
                        <div className="relative">
                            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 blur-xl" />
                            <div className="relative flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-gradient-to-br from-card to-muted/30 shadow-lg shadow-black/5">
                                <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.02)_50%)] bg-[length:100%_4px]" />
                                <Terminal className="size-9 text-muted-foreground/80" strokeWidth={1.5} />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                No Project Selected
                            </h2>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Select a project from the sidebar to access terminal sessions for your active worktrees.
                            </p>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3 text-left text-xs text-muted-foreground">
                            <FolderOpen className="size-4 shrink-0 text-brand/70" />
                            <span>
                                Terminals are available for cards in <strong className="font-medium text-foreground/80">In Progress</strong> or <strong className="font-medium text-foreground/80">Review</strong> with active worktrees.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <PageHeader
                title="Terminals"
                description="Interactive shell sessions for your active worktrees."
                titleAccessory={
                    <div className="flex items-center gap-1.5 rounded-md border border-brand/20 bg-brand/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand">
                        <Sparkles className="size-3" />
                        <span>Live</span>
                    </div>
                }
            />
            <div className="flex-1 overflow-hidden">
                <TerminalsToolWindow projectId={projectId} className="h-full" />
            </div>
        </div>
    )
}
