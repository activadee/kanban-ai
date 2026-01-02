import {useState} from 'react'
import {X, Maximize2, Minimize2, Terminal as TerminalIcon, Loader2, AlertTriangle, Unplug} from 'lucide-react'
import {Terminal} from './Terminal'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import type {TerminalStatus} from './useTerminal'
import {cn} from '@/lib/utils'

export interface TerminalPanelProps {
    cardId: string
    projectId: string
    title: string
    onClose?: () => void
    className?: string
}

const STATUS_CONFIG: Record<TerminalStatus, {
    dotClass: string
    label: string
    icon: typeof Loader2
    badgeClass: string
}> = {
    connecting: {
        dotClass: 'bg-amber-500 animate-pulse',
        label: 'Connecting',
        icon: Loader2,
        badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    connected: {
        dotClass: 'bg-emerald-500',
        label: 'Connected',
        icon: TerminalIcon,
        badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    disconnected: {
        dotClass: 'bg-muted-foreground/40',
        label: 'Disconnected',
        icon: Unplug,
        badgeClass: 'border-border bg-muted/50 text-muted-foreground',
    },
    error: {
        dotClass: 'bg-red-500',
        label: 'Error',
        icon: AlertTriangle,
        badgeClass: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    },
}

export function TerminalPanel({
    cardId,
    projectId,
    title,
    onClose,
    className,
}: TerminalPanelProps) {
    const [status, setStatus] = useState<TerminalStatus>('disconnected')
    const [isMaximized, setIsMaximized] = useState(false)

    const config = STATUS_CONFIG[status]
    const StatusIcon = config.icon

    return (
        <Card
            className={cn(
                'group flex flex-col overflow-hidden border-border/70 bg-card/60 shadow-sm transition-shadow hover:shadow-md',
                isMaximized && 'fixed inset-4 z-50 shadow-2xl',
                className
            )}
        >
            <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent px-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-6 items-center justify-center rounded-md border border-border/50 bg-card">
                        <TerminalIcon className="size-3 text-muted-foreground" />
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-xs font-medium text-foreground">
                            {title}
                        </span>
                        <Badge
                            variant="outline"
                            className={cn(
                                'h-5 gap-1 px-1.5 text-[10px] font-normal transition-colors',
                                config.badgeClass
                            )}
                        >
                            <span className={cn('size-1.5 rounded-full', config.dotClass)} />
                            <StatusIcon className={cn(
                                'size-2.5',
                                status === 'connecting' && 'animate-spin'
                            )} />
                            <span className="hidden sm:inline">{config.label}</span>
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground/70 hover:text-foreground"
                        onClick={() => setIsMaximized(!isMaximized)}
                        title={isMaximized ? 'Restore' : 'Maximize'}
                    >
                        {isMaximized ? (
                            <Minimize2 className="size-3.5" />
                        ) : (
                            <Maximize2 className="size-3.5" />
                        )}
                    </Button>
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                            onClick={onClose}
                            title="Close terminal"
                        >
                            <X className="size-3.5" />
                        </Button>
                    )}
                </div>
            </header>
            <CardContent className="relative flex-1 overflow-hidden p-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.01)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30" />
                <Terminal
                    cardId={cardId}
                    projectId={projectId}
                    className="h-full"
                    onStatusChange={setStatus}
                />
            </CardContent>
        </Card>
    )
}
