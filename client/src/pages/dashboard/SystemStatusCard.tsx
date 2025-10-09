export function SystemStatusCard({
                                     githubLabel,
                                     agentsLabel,
                                 }: {
    githubLabel: string
    agentsLabel: string
}) {
    return (
        <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border/60 p-3">
                <div className="font-medium text-foreground">GitHub</div>
                <p className="mt-1 text-xs text-muted-foreground">{githubLabel}</p>
            </div>
            <div className="rounded-md border border-border/60 p-3">
                <div className="font-medium text-foreground">Agents</div>
                <p className="mt-1 text-xs text-muted-foreground">{agentsLabel}</p>
            </div>
        </div>
    )
}

