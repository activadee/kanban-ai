import type {AttemptLog} from 'shared'
import {cn} from '@/lib/utils'
import {AlertCircle, Info, AlertTriangle, Bug} from 'lucide-react'

const levelConfig: Record<string, {icon: typeof Info; color: string; bg: string}> = {
    debug: {icon: Bug, color: 'text-slate-500', bg: 'bg-slate-500/10'},
    info: {icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10'},
    warn: {icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10'},
    error: {icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10'},
}

export function LogsPane({logs}: {logs: AttemptLog[]}) {
    return (
        <div className="flex-1 min-h-0 overflow-auto rounded-lg bg-muted/20 border border-border/40">
            {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <Info className="h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No logs yet...</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Logs will appear here as the agent runs</p>
                </div>
            ) : (
                <div className="divide-y divide-border/30">
                    {logs.map((log) => {
                        const config = levelConfig[log.level] || levelConfig.info
                        const Icon = config.icon
                        const time = new Date(log.ts).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })
                        
                        return (
                            <div
                                key={log.id}
                                className={cn(
                                    "flex items-start gap-2 px-3 py-2 text-xs font-mono transition-colors hover:bg-muted/30",
                                    config.bg
                                )}
                            >
                                <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", config.color)} />
                                <span className="text-muted-foreground shrink-0 tabular-nums">{time}</span>
                                <span className={cn("uppercase font-semibold w-12 shrink-0", config.color)}>
                                    {log.level}
                                </span>
                                <span className="text-foreground/90 whitespace-pre-wrap break-all flex-1">
                                    {log.message}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
