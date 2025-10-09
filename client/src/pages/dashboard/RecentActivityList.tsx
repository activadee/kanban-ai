import {Button} from '@/components/ui/button'
import {Separator} from '@/components/ui/separator'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Link} from 'react-router-dom'

type Activity = {
    attemptId: string
    status: import('shared').AttemptStatus
    cardTitle: string | null
    ticketKey: string | null
    projectName: string | null
    projectId: string | null
    finishedAt: string | null
    agent: string
}

function formatTicket(title: string | null, ticketKey: string | null): string {
    if (ticketKey && title) return `${ticketKey} · ${title}`
    if (ticketKey) return ticketKey
    return title ?? 'Untitled card'
}

export function RecentActivityList({
                                       items,
                                       isLoading,
                                       finishedLabel,
                                   }: {
    items: Activity[]
    isLoading: boolean
    finishedLabel: (ts: string | null | undefined) => string
}) {
    return (
        <>
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({length: 4}).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attempt history yet. Launch an agent attempt to populate
                    this feed.</p>
            ) : (
                <ul className="space-y-3">
                    {items.map((activity) => (
                        <li key={activity.attemptId}
                            className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge status={activity.status}/>
                                    <span
                                        className="text-sm font-medium text-foreground">{formatTicket(activity.cardTitle, activity.ticketKey)}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>{activity.projectName ?? 'Unknown project'}</span>
                                    <Separator orientation="vertical" className="h-3"/>
                                    <span>{activity.agent}</span>
                                </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                                <div>{finishedLabel(activity.finishedAt)}</div>
                                {activity.projectId ? (
                                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                                        <Link to={`/projects/${activity.projectId}`}>View board</Link>
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

