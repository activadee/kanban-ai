import {useEffect, useMemo, useState} from 'react'
import type {AttemptStatus, DashboardInbox, InboxItem} from 'shared'
import {Link} from 'react-router-dom'
import {ArrowUpRight, GitPullRequest, RotateCcw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Separator} from '@/components/ui/separator'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {toast} from '@/components/ui/toast'
import {startAttemptRequest} from '@/api/attempts'
import {describeApiError} from '@/api/http'

type InboxFilter = 'all' | 'review' | 'failed' | 'stuck'

type Props = {
    inbox: DashboardInbox | undefined
    isLoading: boolean
    hasError: boolean
    onReload: () => void
    formatTime: (value: string | null | undefined) => string
    onAttemptNavigate?: (attemptId: string) => void
}

const INBOX_FILTER_STORAGE_KEY = 'dashboard.inboxFilter'

function resolveFilterFromStorage(): InboxFilter {
    if (typeof window === 'undefined') return 'all'
    const raw = window.sessionStorage.getItem(INBOX_FILTER_STORAGE_KEY)
    if (raw === 'review' || raw === 'failed' || raw === 'stuck' || raw === 'all') {
        return raw
    }
    return 'all'
}

function storeFilter(value: InboxFilter) {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(INBOX_FILTER_STORAGE_KEY, value)
    } catch {
        // Best-effort persistence; ignore storage errors.
    }
}

function formatTicket(title: string | null | undefined, ticketKey: string | null | undefined): string {
    if (ticketKey && title) return `${ticketKey} · ${title}`
    if (ticketKey) return ticketKey
    return title ?? 'Untitled card'
}

function getKindLabel(kind: InboxItem['type'] | undefined): string {
    if (kind === 'failed') return 'Failed'
    if (kind === 'stuck') return 'Stuck'
    return 'Review'
}

function getKindVariant(kind: InboxItem['type'] | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (kind === 'failed') return 'destructive'
    if (kind === 'stuck') return 'outline'
    return 'secondary'
}

function getLastActivityTimestamp(item: InboxItem): string | null | undefined {
    return item.lastUpdatedAt ?? item.finishedAt ?? item.updatedAt ?? item.createdAt
}

function sortByLastActivity(items: InboxItem[]): InboxItem[] {
    return items
        .slice()
        .sort((a, b) => {
            const aTs = getLastActivityTimestamp(a)
            const bTs = getLastActivityTimestamp(b)
            if (!aTs && !bTs) return 0
            if (!aTs) return 1
            if (!bTs) return -1
            const aTime = new Date(aTs).getTime()
            const bTime = new Date(bTs).getTime()
            if (!Number.isFinite(aTime) || Number.isNaN(aTime)) return 1
            if (!Number.isFinite(bTime) || Number.isNaN(bTime)) return -1
            return bTime - aTime
        })
}

async function retryFailedInboxItem(item: InboxItem): Promise<void> {
    const projectId = item.projectId
    const cardId = item.cardId
    const agentId = item.agentId

    if (!projectId || !cardId || !agentId) {
        toast({
            title: 'Retry unavailable',
            description: 'Missing project, card, or agent information for this item.',
            variant: 'destructive',
        })
        return
    }

    await startAttemptRequest({
        projectId,
        cardId,
        agent: agentId,
    })
}

export function InboxPanel({
                               inbox,
                               isLoading,
                               hasError,
                               onReload,
                               formatTime,
                               onAttemptNavigate,
                           }: Props) {
    const [filter, setFilter] = useState<InboxFilter>(() => resolveFilterFromStorage())
    const [retryingId, setRetryingId] = useState<string | null>(null)

    useEffect(() => {
        storeFilter(filter)
    }, [filter])

    const reviewItems = inbox?.review ?? []
    const failedItems = inbox?.failed ?? []
    const stuckItems = inbox?.stuck ?? []

    const allItems = useMemo<InboxItem[]>(() => {
        if (!inbox) return []
        const combined: InboxItem[] = []
        combined.push(...inbox.review, ...inbox.failed, ...inbox.stuck)
        return sortByLastActivity(combined)
    }, [inbox])

    const filteredItems = useMemo<InboxItem[]>(() => {
        if (filter === 'all') return allItems
        if (filter === 'review') return sortByLastActivity(reviewItems)
        if (filter === 'failed') return sortByLastActivity(failedItems)
        return sortByLastActivity(stuckItems)
    }, [filter, allItems, reviewItems, failedItems, stuckItems])

    const totalCount = reviewItems.length + failedItems.length + stuckItems.length
    const filterCount =
        filter === 'all'
            ? totalCount
            : filter === 'review'
                ? reviewItems.length
                : filter === 'failed'
                    ? failedItems.length
                    : stuckItems.length

    const showEmptyMessage = !isLoading && !hasError && totalCount === 0
    const showFilteredEmptyMessage = !isLoading && !hasError && totalCount > 0 && filteredItems.length === 0

    const handleRetryClick = async (item: InboxItem) => {
        setRetryingId(item.id)
        try {
            await retryFailedInboxItem(item)
            toast({
                title: 'Retry started',
                description: 'A new attempt has been queued from this failed item.',
                variant: 'success',
            })
            onReload()
        } catch (error) {
            const problem = describeApiError(error, 'Failed to retry attempt')
            toast({
                title: problem.title,
                description: problem.description,
                variant: 'destructive',
            })
        } finally {
            setRetryingId((current) => (current === item.id ? null : current))
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Tabs
                    value={filter}
                    onValueChange={(value) => setFilter(value as InboxFilter)}
                    className="flex-1"
                >
                    <TabsList aria-label="Filter inbox items" className="h-8">
                        <TabsTrigger value="all" className="px-2 text-xs">
                            All
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                {totalCount}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="review" className="px-2 text-xs">
                            Review
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                {reviewItems.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="failed" className="px-2 text-xs">
                            Failed
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                {failedItems.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="stuck" className="px-2 text-xs">
                            Stuck
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                {stuckItems.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {filterCount > 0 ? (
                        <span>
                            {filterCount} item{filterCount === 1 ? '' : 's'} in view
                        </span>
                    ) : null}
                    <Separator orientation="vertical" className="hidden h-4 sm:block"/>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={onReload}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2" data-testid="inbox-loading">
                    {Array.from({length: 4}).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                    ))}
                </div>
            ) : hasError ? (
                <div
                    className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
                    data-testid="inbox-error"
                >
                    <div>
                        <div className="font-medium">Unable to load inbox items.</div>
                        <div className="mt-1 opacity-80">
                            Check your connection and try again.
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-destructive/40 text-[11px]"
                        onClick={onReload}
                    >
                        Retry
                    </Button>
                </div>
            ) : showEmptyMessage ? (
                <p className="text-sm text-muted-foreground" data-testid="inbox-empty">
                    No items need your attention right now.
                </p>
            ) : (
                <>
                    {showFilteredEmptyMessage ? (
                        <p className="text-xs text-muted-foreground" data-testid="inbox-filter-empty">
                            No inbox items match this filter. Try switching to a different kind or adjust the dashboard
                            time range.
                        </p>
                    ) : null}

                    <div className="overflow-x-auto">
                        <div className="min-w-[720px] space-y-1" data-testid="inbox-list">
                            <div className="grid grid-cols-[0.9fr,2fr,1.5fr,1.3fr,1.3fr,auto] gap-3 px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <div>Kind</div>
                                <div>Card</div>
                                <div>Project</div>
                                <div>Agent</div>
                                <div>Last activity</div>
                                <div className="text-right">Actions</div>
                            </div>

                            <TooltipProvider delayDuration={150}>
                                <ul className="space-y-1">
                                    {filteredItems.map((item) => {
                                        const kind = item.type
                                        const kindLabel = getKindLabel(kind)
                                        const lastActivityTs = getLastActivityTimestamp(item)
                                        const lastActivityLabel = formatTime(lastActivityTs)
                                        const hasAttempt = Boolean(item.attemptId)
                                        const hasProject = Boolean(item.projectId)
                                        const isRetrying = retryingId === item.id

                                        return (
                                            <li
                                                key={item.id}
                                                className="group grid cursor-pointer grid-cols-[0.9fr,2fr,1.5fr,1.3fr,1.3fr,auto] items-center gap-3 rounded-md border border-border/60 bg-background/40 px-2 py-2 text-xs hover:bg-muted/40"
                                                role={hasAttempt && onAttemptNavigate ? 'button' : undefined}
                                                tabIndex={hasAttempt && onAttemptNavigate ? 0 : undefined}
                                                onClick={() => {
                                                    if (hasAttempt && onAttemptNavigate && item.attemptId) {
                                                        onAttemptNavigate(item.attemptId)
                                                    }
                                                }}
                                                onKeyDown={(event) => {
                                                    if (!hasAttempt || !onAttemptNavigate || !item.attemptId) return
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        onAttemptNavigate(item.attemptId)
                                                    }
                                                }}
                                                data-testid="inbox-row"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={getKindVariant(kind)}
                                                        className="h-6 px-2 text-[11px]"
                                                    >
                                                        {kindLabel}
                                                    </Badge>
                                                </div>

                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            {hasProject ? (
                                                                <Link
                                                                    to={`/projects/${item.projectId}`}
                                                                    className="max-w-full truncate text-[13px] font-medium text-foreground hover:underline"
                                                                    onClick={(event) => event.stopPropagation()}
                                                                >
                                                                    {formatTicket(item.cardTitle, item.ticketKey)}
                                                                </Link>
                                                            ) : (
                                                                <span className="max-w-full truncate text-[13px] font-medium text-foreground">
                                                                    {formatTicket(item.cardTitle, item.ticketKey)}
                                                                </span>
                                                            )}
                                                        </TooltipTrigger>
                                                        <TooltipContent align="start" className="max-w-xs">
                                                            {formatTicket(item.cardTitle, item.ticketKey)}
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    {item.cardStatus ? (
                                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                                            {item.cardStatus}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="flex min-w-0 items-center text-[11px] text-muted-foreground">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="max-w-full truncate">
                                                                {item.projectName ?? 'Unknown project'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent align="start" className="max-w-xs">
                                                            {item.projectName ?? 'Unknown project'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>

                                                <div className="flex min-w-0 items-center text-[11px] text-muted-foreground">
                                                    {item.agentName || item.agentId ? (
                                                        <span className="max-w-full truncate">
                                                            {item.agentName ?? item.agentId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/70">Unknown agent</span>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-start text-[11px] text-muted-foreground">
                                                    <div>{lastActivityLabel}</div>
                                                    {item.status ? (
                                                        <div className="mt-0.5">
                                                            <StatusBadge
                                                                status={
                                                                    (item.status as AttemptStatus | 'idle') ?? 'idle'
                                                                }
                                                                className="h-5 text-[10px]"
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="flex items-center justify-end gap-1 text-[11px]">
                                                    {hasAttempt && onAttemptNavigate ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="size-7 text-muted-foreground hover:text-foreground"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        if (item.attemptId) {
                                                                            onAttemptNavigate(item.attemptId)
                                                                        }
                                                                    }}
                                                                    aria-label="View attempt details"
                                                                >
                                                                    <ArrowUpRight className="size-3.5"/>
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View attempt</TooltipContent>
                                                        </Tooltip>
                                                    ) : null}

                                                    {item.prUrl ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="size-7 text-muted-foreground hover:text-foreground"
                                                                    asChild
                                                                    aria-label="Open pull request"
                                                                >
                                                                    <a
                                                                        href={item.prUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        onClick={(event) => event.stopPropagation()}
                                                                    >
                                                                        <GitPullRequest className="size-3.5"/>
                                                                    </a>
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View PR</TooltipContent>
                                                        </Tooltip>
                                                    ) : null}

                                                    {item.type === 'failed' ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="size-7 text-muted-foreground hover:text-foreground"
                                                                    disabled={isRetrying}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        void handleRetryClick(item)
                                                                    }}
                                                                    aria-label="Retry failed attempt"
                                                                >
                                                                    <RotateCcw
                                                                        className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`}
                                                                    />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {isRetrying ? 'Retrying…' : 'Retry attempt'}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : null}
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </TooltipProvider>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
