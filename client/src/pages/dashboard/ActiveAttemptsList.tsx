import {Button} from '@/components/ui/button'
import {Separator} from '@/components/ui/separator'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Link} from 'react-router-dom'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {getAttemptPath, getProjectCardPath} from '@/lib/routes'

type Attempt = {
    attemptId: string
    status: import('shared').AttemptStatus
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    projectName: string | null
    projectId: string | null
    startedAt: string | null
    updatedAt: string | null
    agent: string
}

function formatTicket(title: string | null, ticketKey: string | null): string {
    if (ticketKey && title) return `${ticketKey} · ${title}`
    if (ticketKey) return ticketKey
    return title ?? 'Untitled card'
}

export function ActiveAttemptsList({
                                       attempts,
                                       isLoading,
                                       updatedLabel,
                                       onSelectAttempt,
                                   }: {
    attempts: Attempt[]
    isLoading: boolean
    updatedLabel: (ts: string | null | undefined) => string
    onSelectAttempt?: (attemptId: string) => void
}) {
    return (
        <>
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({length: 4}).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                    ))}
                </div>
            ) : attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active attempts right now.</p>
            ) : (
                <ul className="max-h-72 space-y-3 overflow-y-auto pr-1" data-testid="active-attempts-list">
                    {attempts.map((attempt) => (
                        <li
                            key={attempt.attemptId}
                            data-testid="active-attempt-row"
                            className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-border/60 p-3 hover:bg-muted/40"
                            role={onSelectAttempt ? 'button' : undefined}
                            tabIndex={onSelectAttempt ? 0 : undefined}
                            onClick={() => {
                                if (onSelectAttempt) onSelectAttempt(attempt.attemptId)
                            }}
                            onKeyDown={(event) => {
                                if (!onSelectAttempt) return
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    onSelectAttempt(attempt.attemptId)
                                }
                            }}
                        >
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge status={attempt.status}/>
                                    <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Link
                                                    to={
                                                        attempt.projectId
                                                            ? getProjectCardPath(
                                                                  attempt.projectId,
                                                                  attempt.cardId,
                                                              )
                                                            : '#'
                                                    }
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        if (!attempt.projectId) {
                                                            event.preventDefault()
                                                        }
                                                    }}
                                                    className="max-w-xs truncate text-sm font-medium text-foreground hover:underline"
                                                >
                                                    {formatTicket(attempt.cardTitle, attempt.ticketKey)}
                                                </Link>
                                            </TooltipTrigger>
                                            <TooltipContent align="start" className="max-w-xs">
                                                Open board for this attempt
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="max-w-[180px] truncate">
                                                    {attempt.projectName ?? 'Unknown project'}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent align="start">
                                                {attempt.projectName ?? 'Unknown project'}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <Separator orientation="vertical" className="h-3"/>
                                    <span className="max-w-[140px] truncate">{attempt.agent}</span>
                                </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                                <div>
                                    {attempt.startedAt
                                        ? `Started ${updatedLabel(attempt.startedAt)}`
                                        : `Updated ${updatedLabel(attempt.updatedAt)}`}
                                </div>
                                <div>
                                    <Button
                                        asChild
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs"
                                    >
                                        <Link
                                            to={getAttemptPath(attempt.attemptId)}
                                            onClick={(event) => event.stopPropagation()}
                                            aria-label="Open attempt details"
                                        >
                                            View attempt
                                        </Link>
                                    </Button>
                                </div>
                                {attempt.projectId ? (
                                    <Button
                                        asChild
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs"
                                    >
                                        <Link
                                            to={getProjectCardPath(attempt.projectId, attempt.cardId)}
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            Open board
                                        </Link>
                                    </Button>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </>
    )
}
