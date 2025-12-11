import {useMemo, useState} from 'react'
import type {AttemptActivityItem} from 'shared'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Separator} from '@/components/ui/separator'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Link} from 'react-router-dom'
import {formatAttemptDuration} from './formatters'

type Props = {
    attempts: AttemptActivityItem[]
    isLoading: boolean
    hasError: boolean
    timeRangeLabel: string
    formatRelativeTime: (value: string | null | undefined) => string
    onRetry: () => void
    onAttemptNavigate?: (attemptId: string) => void
}

const PAGE_SIZE = 10

function formatAbsoluteTimestamp(value: string | null | undefined): string {
    if (!value) return 'Unknown'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return date.toLocaleString()
}

function formatTicket(title: string | null, ticketKey: string | null): string {
    if (ticketKey && title) return `${ticketKey} · ${title}`
    if (ticketKey) return ticketKey
    return title ?? 'Untitled card'
}

export function RecentAttemptHistoryPanel({
                                              attempts,
                                              isLoading,
                                              hasError,
                                              timeRangeLabel,
                                              formatRelativeTime,
                                              onRetry,
                                              onAttemptNavigate,
                                          }: Props) {
    const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)

    const sortedAttempts: AttemptActivityItem[] = useMemo(() => {
        return [...attempts].sort((a, b) => {
            const aTs = a.occurredAt ? Date.parse(a.occurredAt) : NaN
            const bTs = b.occurredAt ? Date.parse(b.occurredAt) : NaN
            const aValid = Number.isFinite(aTs)
            const bValid = Number.isFinite(bTs)
            if (aValid && bValid) return bTs - aTs
            if (aValid) return -1
            if (bValid) return 1
            return 0
        })
    }, [attempts])

    const visibleAttempts = sortedAttempts.slice(0, visibleCount)
    const canShowMore = sortedAttempts.length > visibleCount
    const canShowLess = sortedAttempts.length > PAGE_SIZE && visibleCount > PAGE_SIZE

    const isEmpty = !isLoading && !hasError && sortedAttempts.length === 0

    return (
        <Card className="border-border/70 bg-card/60">
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle>Recent Attempt History</CardTitle>
                        <CardDescription>
                            Completed attempts across boards, ordered by most recent.
                        </CardDescription>
                    </div>
                    <span className="mt-1 text-xs text-muted-foreground">
                        {timeRangeLabel}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {hasError ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        <span>Unable to load recent attempt history.</span>
                        <Button size="sm" variant="outline" onClick={onRetry}>
                            Retry
                        </Button>
                    </div>
                ) : null}

                {isLoading ? (
                    <div className="space-y-3" data-testid="recent-attempt-history-skeleton">
                        {Array.from({length: PAGE_SIZE}).map((_, index) => (
                            <div
                                key={index}
                                className="h-14 animate-pulse rounded-md bg-muted/60"
                            />
                        ))}
                    </div>
                ) : isEmpty ? (
                    <p className="text-sm text-muted-foreground">
                        No recent attempts yet. Once runs complete, they’ll appear here.
                    </p>
                ) : (
                    <>
                        <ul
                            className="space-y-3"
                            data-testid="recent-attempt-history-list"
                        >
                            {visibleAttempts.map((item) => {
                                const absolute = formatAbsoluteTimestamp(item.occurredAt)
                                const relative = formatRelativeTime(item.occurredAt)
                                const durationLabel = formatAttemptDuration(
                                    item.durationSeconds,
                                )
                                const agentLabel =
                                    item.agentId && item.agentId.trim().length > 0
                                        ? item.agentId
                                        : 'Unknown agent'

                                const statusToneClass =
                                    item.status === 'succeeded'
                                        ? 'bg-emerald-500 dark:bg-emerald-400'
                                        : item.status === 'failed'
                                            ? 'bg-rose-500 dark:bg-rose-400'
                                            : 'bg-zinc-400 dark:bg-zinc-500'

                                return (
                                    <li
                                        key={item.attemptId}
                                        data-testid="recent-attempt-history-row"
                                        className="flex items-start gap-3 rounded-md border border-border/60 p-3 hover:bg-muted/40"
                                        role={onAttemptNavigate ? 'button' : undefined}
                                        tabIndex={onAttemptNavigate ? 0 : undefined}
                                        onClick={() => {
                                            if (onAttemptNavigate) {
                                                onAttemptNavigate(item.attemptId)
                                            }
                                        }}
                                        onKeyDown={(event) => {
                                            if (!onAttemptNavigate) return
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                onAttemptNavigate(item.attemptId)
                                            }
                                        }}
                                    >
                                        <div className="mt-1 flex flex-col items-center">
                                            <div
                                                className={`h-2 w-2 rounded-full ${statusToneClass}`}
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className="flex flex-1 flex-col gap-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <StatusBadge status={item.status}/>
                                                <Link
                                                    to={
                                                        item.projectId
                                                            ? `/projects/${item.projectId}`
                                                            : '#'
                                                    }
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        if (!item.projectId) {
                                                            event.preventDefault()
                                                        }
                                                    }}
                                                    className="max-w-[260px] truncate text-sm font-medium text-foreground hover:underline"
                                                >
                                                    {formatTicket(
                                                        item.cardTitle,
                                                        item.ticketKey,
                                                    )}
                                                </Link>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span className="max-w-[180px] truncate">
                                                    {item.projectName ?? 'Unknown project'}
                                                </span>
                                                <Separator orientation="vertical" className="h-3"/>
                                                <span className="max-w-[140px] truncate">
                                                    {agentLabel}
                                                </span>
                                                {durationLabel !== '—' ? (
                                                    <>
                                                        <Separator
                                                            orientation="vertical"
                                                            className="h-3"
                                                        />
                                                        <span>Duration {durationLabel}</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                            <div className="whitespace-nowrap">
                                                {absolute}
                                            </div>
                                            <div className="mt-0.5">{relative}</div>
                                            <Button
                                                asChild
                                                variant="link"
                                                size="sm"
                                                className="mt-1 h-auto p-0 text-xs"
                                            >
                                                <Link
                                                    to={`/attempts/${item.attemptId}`}
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    View attempt
                                                </Link>
                                            </Button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>

                        {(canShowMore || canShowLess) && (
                            <div className="flex justify-end gap-2 pt-1 text-xs">
                                {canShowLess ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2"
                                        onClick={() => setVisibleCount(PAGE_SIZE)}
                                    >
                                        Show less
                                    </Button>
                                ) : null}
                                {canShowMore ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2"
                                        onClick={() =>
                                            setVisibleCount((current) =>
                                                Math.min(
                                                    current + PAGE_SIZE,
                                                    sortedAttempts.length,
                                                ),
                                            )
                                        }
                                    >
                                        Show more
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
