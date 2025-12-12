import {useEffect, useMemo, useState} from 'react'
import type {AttemptStatus, DashboardInbox, InboxItem} from 'shared'
import {Link} from 'react-router-dom'
import {ArrowUpRight, CheckCircle2, Circle, GitPullRequest, RotateCcw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Separator} from '@/components/ui/separator'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {toast} from '@/components/ui/toast'
import {startAttemptRequest} from '@/api/attempts'
import {describeApiError} from '@/api/http'
import {getProjectCardPath} from '@/lib/routes'
import {markAllInboxRead, patchInboxItemRead} from '@/api/dashboard'

type InboxFilter = 'all' | 'review' | 'failed' | 'stuck'
type ReadFilter = 'all' | 'unread' | 'read'

type Props = {
    inbox: DashboardInbox | undefined
    isLoading: boolean
    hasError: boolean
    onReload: () => void
    formatTime: (value: string | null | undefined) => string
    onAttemptNavigate?: (attemptId: string) => void
}

const INBOX_FILTER_STORAGE_KEY = 'dashboard.inboxFilter'
const INBOX_READ_FILTER_STORAGE_KEY = 'dashboard.inboxReadFilter'

function resolveFilterFromStorage(): InboxFilter {
    if (typeof window === 'undefined') return 'all'
    const raw = window.sessionStorage.getItem(INBOX_FILTER_STORAGE_KEY)
    if (raw === 'review' || raw === 'failed' || raw === 'stuck' || raw === 'all') {
        return raw
    }
    return 'all'
}

function resolveReadFilterFromStorage(): ReadFilter {
    if (typeof window === 'undefined') return 'all'
    const raw = window.sessionStorage.getItem(INBOX_READ_FILTER_STORAGE_KEY)
    if (raw === 'all' || raw === 'unread' || raw === 'read') return raw
    return 'unread'
}

function storeFilter(value: InboxFilter) {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(INBOX_FILTER_STORAGE_KEY, value)
    } catch {
        // Best-effort persistence; ignore storage errors.
    }
}

function storeReadFilter(value: ReadFilter) {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(INBOX_READ_FILTER_STORAGE_KEY, value)
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

async function retryFailedInboxItem(item: InboxItem): Promise<boolean> {
    const projectId = item.projectId
    const cardId = item.cardId
    const agentId = item.agentId

    if (!projectId || !cardId || !agentId) {
        toast({
            title: 'Retry unavailable',
            description: 'Missing project, card, or agent information for this item.',
            variant: 'destructive',
        })
        return false
    }

    await startAttemptRequest({
        projectId,
        cardId,
        agent: agentId,
    })
    return true
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
    const [readFilter, setReadFilter] = useState<ReadFilter>(() => resolveReadFilterFromStorage())
    const [retryingId, setRetryingId] = useState<string | null>(null)
    const [optimisticRead, setOptimisticRead] = useState<Record<string, boolean>>({})

    useEffect(() => {
        storeFilter(filter)
    }, [filter])

    useEffect(() => {
        storeReadFilter(readFilter)
    }, [readFilter])

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

    const filteredByReadState = useMemo<InboxItem[]>(() => {
        if (readFilter === 'all') return filteredItems
        if (readFilter === 'unread') {
            return filteredItems.filter((item) => (optimisticRead[item.id] ?? item.isRead ?? false) === false)
        }
        return filteredItems.filter((item) => (optimisticRead[item.id] ?? item.isRead ?? false) === true)
    }, [filteredItems, readFilter, optimisticRead])

    const totalCount = reviewItems.length + failedItems.length + stuckItems.length
    const viewCount = filteredByReadState.length

    const showEmptyMessage = !isLoading && !hasError && totalCount === 0
    const showFilteredEmptyMessage =
        !isLoading && !hasError && totalCount > 0 && viewCount === 0

    const handleRetryClick = async (item: InboxItem) => {
        setRetryingId(item.id)
        try {
            const started = await retryFailedInboxItem(item)
            if (!started) {
                return
            }
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
                    {viewCount > 0 ? (
                        <span>
                            {viewCount} item{viewCount === 1 ? '' : 's'} in view
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
                    <Separator orientation="vertical" className="hidden h-4 sm:block"/>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        disabled={totalCount === 0}
                        onClick={async () => {
                            if (totalCount === 0) return
                            const confirmed = window.confirm(
                                'Mark all inbox items as read? You can switch to the "Read" filter to revisit them.',
                            )
                            if (!confirmed) return
                            const ids = allItems.map((i) => i.id)
                            setOptimisticRead((current) => {
                                const next = {...current}
                                for (const id of ids) next[id] = true
                                return next
                            })
                            try {
                                await markAllInboxRead()
                                toast({
                                    title: 'Inbox cleared',
                                    description: 'All items marked as read.',
                                    variant: 'success',
                                })
                                onReload()
                            } catch (error) {
                                setOptimisticRead((current) => {
                                    const next = {...current}
                                    for (const id of ids) delete next[id]
                                    return next
                                })
                                const problem = describeApiError(error, 'Failed to mark all read')
                                toast({
                                    title: problem.title,
                                    description: problem.description,
                                    variant: 'destructive',
                                })
                            }
                        }}
                    >
                        Mark all read
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <Tabs
                    value={readFilter}
                    onValueChange={(value) => setReadFilter(value as ReadFilter)}
                    className="flex-1"
                >
                    <TabsList aria-label="Filter inbox items by read status" className="h-7">
                        <TabsTrigger value="all" className="px-2 text-[11px]">
                            All
                        </TabsTrigger>
                        <TabsTrigger value="unread" className="px-2 text-[11px]">
                            Unread
                        </TabsTrigger>
                        <TabsTrigger value="read" className="px-2 text-[11px]">
                            Read
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
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

                    <div
                        className="max-h-80 overflow-auto rounded-md border border-border/60 bg-background/20"
                        data-testid="inbox-scroll-container"
                    >
                        <TooltipProvider delayDuration={150}>
                            <ul className="space-y-1 p-1" data-testid="inbox-list">
                                {filteredByReadState.map((item) => {
                                    const kind = item.type
                                    const kindLabel = getKindLabel(kind)
                                    const lastActivityTs = getLastActivityTimestamp(item)
                                    const lastActivityLabel = formatTime(lastActivityTs)
                                    const hasAttempt = Boolean(item.attemptId)
                                    const hasProject = Boolean(item.projectId)
                                    const isRetrying = retryingId === item.id
                                    const itemIsRead = optimisticRead[item.id] ?? item.isRead ?? false
                                    const agentLabel =
                                        item.agentName ?? item.agentId ?? 'Unknown agent'

                                    return (
                                        <li
                                            key={item.id}
                                            className={`group flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs hover:bg-muted/40 ${
                                                itemIsRead ? 'opacity-60' : ''
                                            }`}
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
                                            <div className="flex shrink-0 flex-col items-start gap-1 pt-0.5">
                                                <Badge
                                                    variant={getKindVariant(kind)}
                                                    className="h-6 px-2 text-[11px]"
                                                >
                                                    {kindLabel}
                                                </Badge>
                                                {item.status ? (
                                                    <StatusBadge
                                                        status={(item.status as AttemptStatus | 'idle') ?? 'idle'}
                                                        className="h-5 text-[10px]"
                                                    />
                                                ) : null}
                                            </div>

                                            <div className="min-w-0 flex-1 space-y-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        {hasProject ? (
                                                            <Link
                                                                to={getProjectCardPath(
                                                                    item.projectId!,
                                                                    item.cardId ?? undefined,
                                                                )}
                                                                className={`block max-w-full truncate text-[13px] hover:underline ${
                                                                    itemIsRead
                                                                        ? 'font-normal text-muted-foreground'
                                                                        : 'font-medium text-foreground'
                                                                }`}
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                {formatTicket(item.cardTitle, item.ticketKey)}
                                                            </Link>
                                                        ) : (
                                                            <span
                                                                className={`block max-w-full truncate text-[13px] ${
                                                                    itemIsRead
                                                                        ? 'font-normal text-muted-foreground'
                                                                        : 'font-medium text-foreground'
                                                                }`}
                                                            >
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

                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="max-w-[160px] truncate">
                                                                {item.projectName ?? 'Unknown project'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent align="start" className="max-w-xs">
                                                            {item.projectName ?? 'Unknown project'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <Separator orientation="vertical" className="h-3"/>
                                                    <span className="max-w-[160px] truncate">
                                                        {agentLabel}
                                                    </span>
                                                    <Separator orientation="vertical" className="h-3"/>
                                                    <span className="whitespace-nowrap">
                                                        Last activity {lastActivityLabel}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1 pt-0.5 text-[11px]">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-7 text-muted-foreground hover:text-foreground"
                                                            onClick={async (event) => {
                                                                event.stopPropagation()
                                                                const nextRead = !itemIsRead
                                                                setOptimisticRead((current) => ({
                                                                    ...current,
                                                                    [item.id]: nextRead,
                                                                }))
                                                                try {
                                                                    await patchInboxItemRead(item.id, nextRead)
                                                                    onReload()
                                                                } catch (error) {
                                                                    setOptimisticRead((current) => {
                                                                        const reverted = {...current}
                                                                        delete reverted[item.id]
                                                                        return reverted
                                                                    })
                                                                    const problem = describeApiError(
                                                                        error,
                                                                        'Failed to update read status',
                                                                    )
                                                                    toast({
                                                                        title: problem.title,
                                                                        description: problem.description,
                                                                        variant: 'destructive',
                                                                    })
                                                                }
                                                            }}
                                                            aria-label={itemIsRead ? 'Mark unread' : 'Mark read'}
                                                        >
                                                            {itemIsRead ? (
                                                                <CheckCircle2 className="size-3.5"/>
                                                            ) : (
                                                                <Circle className="size-3.5"/>
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {itemIsRead ? 'Mark unread' : 'Mark read'}
                                                    </TooltipContent>
                                                </Tooltip>

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
                                                        <TooltipContent>Open attempt details</TooltipContent>
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
                                                                    rel="noopener noreferrer"
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    aria-label="Open pull request"
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
                </>
            )}
        </div>
    )
}
