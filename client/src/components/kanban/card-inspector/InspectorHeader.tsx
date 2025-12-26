import type {ReactNode} from 'react'
import {Badge} from '@/components/ui/badge'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {X, Lock, Copy} from 'lucide-react'
import type {Card as TCard, CardPlan} from 'shared'
import {formatTicketType, ticketTypeBadgeClass} from '@/lib/ticketTypes'

export function InspectorHeader({
                                    card,
                                    locked,
                                    blocked,
                                    copied,
                                    onCopyTicketKey,
                                    plan,
                                    onClose,
                                    actions,
                                }: {
    card: TCard
    locked?: boolean
    blocked?: boolean
    copied: boolean
    onCopyTicketKey: () => void
    plan?: CardPlan | null
    onClose?: () => void
    actions?: ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {card.ticketKey ? (
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-semibold tracking-tight text-foreground">
                            {card.ticketKey}
                        </Badge>
                        <button type="button" className="inline-flex size-8 items-center justify-center"
                                onClick={onCopyTicketKey} title="Copy ticket key" aria-label="Copy ticket key">
                            <Copy className={`size-4 ${copied ? 'text-emerald-500' : 'text-muted-foreground'}`}/>
                        </button>
                        {copied ? <span className="text-xs text-emerald-500">Copied</span> : null}
                    </div>
                ) : null}
                {card.githubIssue ? (
                    <Badge variant="outline" className="text-xs font-mono tracking-tight">
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
                ) : null}
                <Badge
                    variant="outline"
                    className={`text-[11px] font-semibold tracking-tight ${ticketTypeBadgeClass(card.ticketType)}`}
                >
                    {formatTicketType(card.ticketType)}
                </Badge>
                <span>{card.id.slice(0, 8)}</span>
                {locked ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline">
                                    <Lock className="mr-1 inline-block size-3"/> Locked
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent> This task is Done and locked. No follow-ups or Git
                                actions. </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : blocked ? (
                    <Badge variant="outline" className="border-destructive/50 text-destructive">Blocked</Badge>
                ) : null}
                {plan ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs">Plan saved</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                Updated {new Date(plan.updatedAt).toLocaleString()}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : null}
            </div>
            <div className="flex items-center gap-2">
                {actions}
                {onClose && (
                    <button className="text-muted-foreground hover:text-foreground" onClick={onClose} title="Close"
                            aria-label="Close">
                        <X className="size-4"/>
                    </button>
                )}
            </div>
        </div>
    )
}
