import type {ReactNode, Dispatch, SetStateAction} from 'react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {X, Lock, Copy, FileText, MessageCircle} from 'lucide-react'
import type {Card as TCard} from 'shared'
import {formatTicketType, ticketTypeBadgeClass} from '@/lib/ticketTypes'
import {cn} from '@/lib/utils'

type ViewMode = 'conversation' | 'details'

export function InspectorHeader({
    card,
    locked,
    blocked,
    copied,
    onCopyTicketKey,
    onClose,
    actions,
    viewMode,
    onViewModeChange,
    hasAttempt,
}: {
    card: TCard
    locked?: boolean
    blocked?: boolean
    copied: boolean
    onCopyTicketKey: () => void
    onClose?: () => void
    actions?: ReactNode
    viewMode?: ViewMode
    onViewModeChange?: Dispatch<SetStateAction<ViewMode>>
    hasAttempt?: boolean
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {card.ticketKey && (
                            <div className="flex items-center gap-1">
                                <Badge 
                                    variant="secondary" 
                                    className="font-mono text-xs font-bold tracking-tight px-2 py-0.5"
                                >
                                    {card.ticketKey}
                                </Badge>
                                <button
                                    type="button"
                                    className={cn(
                                        "inline-flex size-6 items-center justify-center rounded-md transition-colors",
                                        "hover:bg-muted text-muted-foreground hover:text-foreground",
                                        copied && "text-emerald-500"
                                    )}
                                    onClick={onCopyTicketKey}
                                    title="Copy ticket key"
                                    aria-label="Copy ticket key"
                                >
                                    <Copy className="size-3" />
                                </button>
                                {copied && <span className="text-[10px] text-emerald-500 animate-in fade-in-50 duration-150">Copied</span>}
                            </div>
                        )}
                        
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] font-semibold tracking-tight",
                                ticketTypeBadgeClass(card.ticketType)
                            )}
                        >
                            {formatTicketType(card.ticketType)}
                        </Badge>
                        
                        {card.githubIssue && (
                            <Badge variant="outline" className="text-[10px] font-mono tracking-tight">
                                <a
                                    href={card.githubIssue.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    #{card.githubIssue.issueNumber}
                                </a>
                            </Badge>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        <span>{card.id.slice(0, 8)}</span>
                        {locked && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[9px] py-0 h-4 gap-0.5">
                                            <Lock className="size-2.5" /> Locked
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        This task is Done and locked. No follow-ups or Git actions.
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {blocked && !locked && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 border-destructive/50 text-destructive">
                                Blocked
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close"
                        >
                            <X className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between gap-3">
                {viewMode && onViewModeChange && (
                    <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
                        <Button
                            variant={viewMode === 'conversation' ? 'secondary' : 'ghost'}
                            size="sm"
                            className={cn(
                                "h-7 gap-1.5 text-xs rounded-md transition-all",
                                viewMode === 'conversation' 
                                    ? "bg-background shadow-sm" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => onViewModeChange('conversation')}
                        >
                            <MessageCircle className="size-3.5" />
                            {hasAttempt ? 'Chat' : 'Start'}
                        </Button>
                        <Button
                            variant={viewMode === 'details' ? 'secondary' : 'ghost'}
                            size="sm"
                            className={cn(
                                "h-7 gap-1.5 text-xs rounded-md transition-all",
                                viewMode === 'details' 
                                    ? "bg-background shadow-sm" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => onViewModeChange('details')}
                        >
                            <FileText className="size-3.5" />
                            Details
                        </Button>
                    </div>
                )}
                
                <div className="flex items-center gap-2 ml-auto">
                    {actions}
                </div>
            </div>
        </div>
    )
}
