import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card as UICard, CardContent} from "@/components/ui/card"
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {Bot, GitPullRequest, Sparkles, Loader2} from 'lucide-react'
import type {Card as TCard} from 'shared'
import type {CardEnhancementStatus} from '@/hooks/tickets'

type Props = {
    card: TCard
    done?: boolean
    showAgentComingSoon?: boolean
    blocked?: boolean
    blockers?: string[]
    enhancementStatus?: CardEnhancementStatus
    onEnhancementClick?: () => void
    disabled?: boolean
}

export function KanbanCard({
                               card,
                               done = false,
                               showAgentComingSoon = false,
                               blocked = false,
                               blockers = [],
                               enhancementStatus,
                               onEnhancementClick,
                               disabled = false,
                           }: Props) {
    const isEnhancing = enhancementStatus === 'enhancing'
    const isReady = enhancementStatus === 'ready'

    const showHeaderRow =
        Boolean(card.ticketKey) ||
        showAgentComingSoon ||
        Boolean(card.prUrl) ||
        blocked ||
        isEnhancing ||
        isReady
    const cardInner = (
        <UICard
            className={`${
                disabled || isEnhancing ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing'
            } ${blocked && !done ? 'border-destructive/40 bg-rose-50/70 dark:bg-rose-950/10' : ''}`}>
            <CardContent className="p-3">
                {showHeaderRow ? (
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {card.ticketKey ? (
                                <Badge variant="outline" className="text-[10px] font-semibold tracking-tight">
                                    {card.ticketKey}
                                </Badge>
                            ) : null}
                            {blocked && !done ? (
                                <Badge variant="outline"
                                       className="border-destructive/50 text-destructive">Blocked</Badge>
                            ) : null}
                            {isEnhancing ? (
                                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                    <Loader2 className="size-3 animate-spin"/>
                                    Enhancing
                                </Badge>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                            {card.prUrl ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                                aria-label="Open pull request"
                                                className="text-muted-foreground"
                                            >
                                                <a href={card.prUrl}
                                                   target="_blank"
                                                   rel="noreferrer noopener"
                                                   onClick={(event) => event.stopPropagation()}
                                                   onPointerDown={(event) => event.stopPropagation()}
                                                >
                                                    <GitPullRequest className="size-4"/>
                                                </a>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">Open pull request</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {showAgentComingSoon ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          aria-label="Review with Agents coming soon"
                          className="text-muted-foreground"
                      >
                        <Bot className="size-4"/>
                      </Button>
                    </span>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">Review with Agents coming soon</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {isReady && onEnhancementClick ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    onEnhancementClick()
                                                }}
                                                aria-label="View enhancement diff"
                                            >
                                                <Sparkles className="size-4"/>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">
                                            View enhancement diff
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                <div
                    className={`text-sm font-medium leading-tight ${done ? 'line-through text-muted-foreground' : ''}`}>{card.title}</div>
            </CardContent>
        </UICard>
    )

    return blockers.length > 0 && blocked && !done ? (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>{cardInner}</TooltipTrigger>
                <TooltipContent align="start" className="max-w-xs">
                    <div className="text-xs">
                        <div className="mb-1 font-medium">Depends on:</div>
                        <ul className="list-inside list-disc space-y-1">
                            {blockers.map((b) => (
                                <li key={b} className="truncate">{b}</li>
                            ))}
                        </ul>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : cardInner
}
