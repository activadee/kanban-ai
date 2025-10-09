import {Button} from '@/components/ui/button'
import {Separator} from '@/components/ui/separator'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Link} from 'react-router-dom'

type Attempt = {
    attemptId: string
    status: import('shared').AttemptStatus
    cardTitle: string | null
    ticketKey: string | null
    projectName: string | null
    projectId: string | null
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
                                   }: {
    attempts: Attempt[]
    isLoading: boolean
    updatedLabel: (ts: string | null | undefined) => string
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
                <ul className="space-y-3">
                    {attempts.map((attempt) => (
                        <li key={attempt.attemptId}
                            className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge status={attempt.status}/>
                                    <span
                                        className="text-sm font-medium text-foreground">{formatTicket(attempt.cardTitle, attempt.ticketKey)}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>{attempt.projectName ?? 'Unknown project'}</span>
                                    <Separator orientation="vertical" className="h-3"/>
                                    <span>{attempt.agent}</span>
                                </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                                <div>{updatedLabel(attempt.updatedAt)}</div>
                                {attempt.projectId ? (
                                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                                        <Link to={`/projects/${attempt.projectId}`}>Open project</Link>
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
