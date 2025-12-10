export interface MetricCardItem {
    label: string
    value: string | number
    helperText?: string
}

interface MetricCardsProps {
    items: MetricCardItem[]
    isLoading?: boolean
}

export function MetricCards({items, isLoading}: MetricCardsProps) {
    return (
        <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
            role="group"
            aria-label="Key performance indicators"
        >
            {items.map((item) => {
                const displayValue = item.value
                const helper = item.helperText
                const ariaLabel =
                    helper && !isLoading
                        ? `${item.label}: ${displayValue} (${helper})`
                        : `${item.label}: ${displayValue}`

                return (
                    <div
                        key={item.label}
                        className="rounded-md border border-border/60 bg-card/60 p-4"
                        role="group"
                        aria-label={ariaLabel}
                    >
                        {isLoading ? (
                            <div className="space-y-2">
                                <div className="h-6 w-20 rounded-md bg-muted/70 animate-pulse" />
                                <div className="h-3 w-16 rounded-md bg-muted/60 animate-pulse" />
                                <div className="h-3 w-24 rounded-md bg-muted/50 animate-pulse" />
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-semibold text-foreground">
                                    {displayValue}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
                                {helper ? (
                                    <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
                                ) : null}
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
