import {Button} from '@/components/ui/button'
import {Bot, GitBranch, GitPullRequest, Layers, Plus} from 'lucide-react'

export function EmptyProjects({onCreate}: {onCreate: () => void}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-8">
                <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-brand/10 via-transparent to-primary/10 blur-xl"/>

                <div className="relative">
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-8">
                        <Layers className="size-12 text-muted-foreground/60"/>
                    </div>
                    <div className="absolute -right-2 -top-2 rounded-full bg-brand/20 p-2">
                        <Plus className="size-4 text-brand"/>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-semibold text-foreground">
                Start your first project
            </h3>

            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Connect a git repository to create your first project. KanbanAI will help you turn tickets into pull requests with AI assistance.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3">
                <Button size="lg" className="gap-2" onClick={onCreate}>
                    <Plus className="size-4"/>
                    Create your first project
                </Button>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <GitBranch className="size-4"/>
                    <span>Git workspace isolation</span>
                </div>
                <div className="flex items-center gap-2">
                    <Bot className="size-4"/>
                    <span>AI agent orchestration</span>
                </div>
                <div className="flex items-center gap-2">
                    <GitPullRequest className="size-4"/>
                    <span>Automatic PR creation</span>
                </div>
            </div>
        </div>
    )
}
