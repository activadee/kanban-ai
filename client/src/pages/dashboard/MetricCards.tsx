export function MetricCards({items}: { items: { label: string; value: string | number; description: string }[] }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((m) => (
                <div key={m.label} className="rounded-md border border-border/60 bg-card/60 p-4">
                    <div className="text-sm text-muted-foreground">{m.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{m.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{m.description}</div>
                </div>
            ))}
        </div>
    )
}

