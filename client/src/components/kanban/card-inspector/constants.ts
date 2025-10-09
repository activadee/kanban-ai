import type {ProcessStatus} from './types'

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
    queued: 'Queued',
    running: 'Running',
    stopping: 'Stopping',
    succeeded: 'Succeeded',
    failed: 'Failed',
    stopped: 'Stopped',
    idle: 'Idle',
}

export const PROCESS_STATUS_STYLES: Record<ProcessStatus, string> = {
    queued: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
    stopping: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    succeeded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    stopped: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200',
    idle: 'bg-muted text-muted-foreground',
}

