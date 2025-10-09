import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card as UICard, CardContent} from "@/components/ui/card"
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {Bot} from 'lucide-react'
import type {Card as TCard} from 'shared'

type Props = {
    card: TCard
    done?: boolean
    showAgentComingSoon?: boolean
    blocked?: boolean
    blockers?: string[]
}

export function KanbanCard({card, done = false, showAgentComingSoon = false, blocked = false, blockers = []}: Props) {
    const showHeaderRow = Boolean(card.ticketKey) || showAgentComingSoon

    const cardInner = (
        <UICard
            className={`cursor-grab active:cursor-grabbing ${blocked && !done ? 'border-destructive/40 bg-rose-50/70 dark:bg-rose-950/10' : ''}`}>
            <CardContent className="p-3">
                {showHeaderRow ? (
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                            {card.ticketKey ? (
                                <Badge variant="outline" className="text-[10px] font-semibold tracking-tight">
                                    {card.ticketKey}
                                </Badge>
                            ) : null}
                            {blocked && !done ? (
                                <Badge variant="outline"
                                       className="ml-2 border-destructive/50 text-destructive">Blocked</Badge>
                            ) : null}
                        </div>
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
                    </div>
                ) : null}
                <div
                    className={`text-sm font-medium leading-tight ${done ? 'line-through text-muted-foreground' : ''}`}>{card.title}</div>
                {card.description && (
                    <div
                        className={`mt-1 text-xs line-clamp-3 ${done ? 'text-muted-foreground/70 line-through' : 'text-muted-foreground'}`}>{card.description}</div>
                )}
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
