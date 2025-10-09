import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {PROCESS_STATUS_LABELS, PROCESS_STATUS_STYLES} from './constants'
import type {ProcessEntry} from './types'

export function ProcessRow({entry}: { entry: ProcessEntry }) {
    return (
        <div
            className="flex flex-col gap-3 rounded border border-border/60 bg-background/80 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 items-start gap-3">
                <div className="mt-0.5 rounded border border-border/50 bg-muted/20 p-1 text-muted-foreground">
                    {entry.icon}
                </div>
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{entry.name}</span>
                        <Badge className={cn('px-2 py-0.5 text-xs font-medium', PROCESS_STATUS_STYLES[entry.status])}>
                            {PROCESS_STATUS_LABELS[entry.status]}
                        </Badge>
                    </div>
                    {entry.description ?
                        <div className="text-xs text-muted-foreground">{entry.description}</div> : null}
                    {entry.meta ? <div className="text-[11px] text-muted-foreground/80">{entry.meta}</div> : null}
                </div>
            </div>
            {entry.actions && entry.actions.length ? (
                <div className="flex items-center gap-2">
                    {entry.actions.map((action) => (
                        <Button
                            key={action.id}
                            size="sm"
                            variant={action.variant ?? 'outline'}
                            disabled={action.disabled}
                            title={action.tooltip}
                            onClick={() => {
                                void action.onClick()
                            }}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

