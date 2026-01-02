import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {PROCESS_STATUS_LABELS, PROCESS_STATUS_STYLES} from './constants'
import type {ProcessEntry} from './types'
import {CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, StopCircle, PauseCircle} from 'lucide-react'
import type {ProcessStatus} from './types'

const statusIcons: Record<ProcessStatus, typeof CheckCircle2> = {
    queued: Clock,
    running: Loader2,
    stopping: PauseCircle,
    succeeded: CheckCircle2,
    failed: XCircle,
    stopped: StopCircle,
    warning: AlertTriangle,
    idle: Clock,
}

export function ProcessRow({entry}: {entry: ProcessEntry}) {
    const StatusIcon = statusIcons[entry.status]
    const isActive = entry.status === 'running' || entry.status === 'stopping'

    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-xl border p-3.5 transition-all duration-200",
                "bg-gradient-to-br from-background to-muted/20",
                isActive 
                    ? "border-primary/30 shadow-sm" 
                    : "border-border/50 hover:border-border/80"
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "mt-0.5 rounded-lg p-2 transition-colors",
                    isActive 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted/50 text-muted-foreground"
                )}>
                    {entry.icon}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                            {entry.name}
                        </span>
                        <Badge 
                            variant="outline"
                            className={cn(
                                'h-5 gap-1 px-1.5 text-[10px] font-medium transition-colors',
                                PROCESS_STATUS_STYLES[entry.status]
                            )}
                        >
                            <StatusIcon className={cn(
                                "h-2.5 w-2.5",
                                entry.status === 'running' && "animate-spin"
                            )} />
                            {PROCESS_STATUS_LABELS[entry.status]}
                        </Badge>
                    </div>
                    {entry.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {entry.description}
                        </p>
                    )}
                    {entry.meta && (
                        <p className="text-[10px] text-muted-foreground/70 font-mono">
                            {entry.meta}
                        </p>
                    )}
                </div>
            </div>
            
            {entry.actions && entry.actions.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
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
                            className="h-7 text-xs"
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    )
}
