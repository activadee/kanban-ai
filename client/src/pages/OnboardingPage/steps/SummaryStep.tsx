import {ShieldCheck} from 'lucide-react'

export function SummaryStep({connected}: { connected: boolean }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="size-5 text-green-500"/>
                You&apos;re ready to go
            </div>
            <p className="text-sm text-muted-foreground">
                Preferences saved {connected ? 'and GitHub connected.' : '— connect GitHub anytime from the sidebar.'}
            </p>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                <div className="text-sm font-medium">Next up</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    <li>Create your first project</li>
                    <li>Import GitHub issues into Kanban columns</li>
                    <li>Kick off an agent run from any card</li>
                </ul>
            </div>
        </div>
    )
}

