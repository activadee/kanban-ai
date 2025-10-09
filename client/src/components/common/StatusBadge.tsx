import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'

type AttemptStatus = import('shared').AttemptStatus

const STATUS_LABEL: Record<AttemptStatus | 'idle', string> = {
    queued: 'Queued',
    running: 'Running',
    stopping: 'Stopping',
    succeeded: 'Succeeded',
    failed: 'Failed',
    stopped: 'Stopped',
    idle: 'Idle',
}

const STATUS_CLASS: Record<AttemptStatus | 'idle', string> = {
    queued: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
    stopping: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    succeeded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    stopped: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200',
    idle: 'bg-muted text-muted-foreground',
}

export function StatusBadge({status, className}: { status: AttemptStatus | 'idle'; className?: string }) {
    return (
        <Badge className={cn('px-2 py-1 text-xs font-medium', STATUS_CLASS[status], className)}>
            {STATUS_LABEL[status]}
        </Badge>
    )
}

export const statusLabel = (status: AttemptStatus | 'idle') => STATUS_LABEL[status]

