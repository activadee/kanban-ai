import {useMemo, useState} from 'react'
import type {ProjectSnapshot} from 'shared'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {
    type ProjectHealthSortKey,
    isHighActivity,
    isHighFailureRate,
    resolveProjectMetrics,
    sortProjectSnapshots,
} from './projectHealthHelpers'
import {SectionEmptyState, SectionErrorBanner} from '@/pages/dashboard/SectionState'

type Props = {
    snapshots: ProjectSnapshot[]
    isLoading: boolean
    hasError?: boolean
    onProjectNavigate?: (projectId: string) => void
    onRetry?: () => void
}

function formatFailureRatePercentage(value: number | null): string {
    if (value == null || Number.isNaN(value)) return '—'
    const percentage = value * 100
    if (!Number.isFinite(percentage)) return '—'
    return `${percentage.toFixed(0)}%`
}

export function ProjectHealthPanel({snapshots, isLoading, hasError, onProjectNavigate, onRetry}: Props) {
    const [sortKey, setSortKey] = useState<ProjectHealthSortKey>('openCards')

    const sortedSnapshots = useMemo(
        () => sortProjectSnapshots(snapshots, sortKey),
        [snapshots, sortKey],
    )

    const hasProjects = sortedSnapshots.length > 0

    return (
        <Card className="border-border/70 bg-card/60">
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Project Health</CardTitle>
                        <CardDescription>
                            Project workload and card counts in the selected time range.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">Sort by</span>
                        <Select
                            value={sortKey}
                            onValueChange={(value) => setSortKey(value as ProjectHealthSortKey)}
                        >
                            <SelectTrigger
                                aria-label="Sort projects"
                                className="h-8 w-[180px] text-xs"
                            >
                                <SelectValue placeholder="Sort projects"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openCards">Open cards (desc)</SelectItem>
                                <SelectItem value="failedAttemptsInRange">
                                    Failed attempts (desc)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {hasError ? (
                    <SectionErrorBanner
                        data-testid="project-health-error"
                        title="Unable to load project health."
                        description="Check your connection and retry the dashboard snapshot."
                        onRetry={onRetry}
                    />
                ) : null}

                {isLoading ? (
                    <div className="space-y-3" data-testid="project-health-loading">
                        {Array.from({length: 4}).map((_, index) => (
                            <div
                                key={index}
                                className="h-12 animate-pulse rounded-md bg-muted/60"
                            />
                        ))}
                    </div>
                ) : !hasProjects && !hasError ? (
                    <SectionEmptyState
                        title="No projects yet"
                        description="Create a project to populate this list."
                    />
                ) : hasProjects ? (
                    <ul className="max-h-80 space-y-3 overflow-y-auto pr-1" data-testid="project-health-list">
                        {sortedSnapshots.map((snapshot) => (
                            <ProjectHealthRow
                                key={snapshot.id}
                                snapshot={snapshot}
                                onProjectNavigate={onProjectNavigate}
                            />
                        ))}
                    </ul>
                ) : null}
            </CardContent>
        </Card>
    )
}

type RowProps = {
    snapshot: ProjectSnapshot
    onProjectNavigate?: (projectId: string) => void
}

function ProjectHealthRow({snapshot, onProjectNavigate}: RowProps) {
    const metrics = resolveProjectMetrics(snapshot)
    const highActivity = isHighActivity(snapshot)
    const highFailureRate = isHighFailureRate(snapshot)

    const repositoryLabel =
        snapshot.repositorySlug ?? snapshot.repositoryPath ?? undefined

    const hasAttemptsInRange = metrics.attemptsInRange > 0

    const handleActivate = () => {
        if (onProjectNavigate) {
            onProjectNavigate(snapshot.id)
        }
    }

    return (
        <li
            className="flex cursor-pointer flex-col gap-2 rounded-md border border-border/60 p-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            role="button"
            tabIndex={0}
            onClick={handleActivate}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleActivate()
                }
            }}
            aria-label={`View project ${snapshot.name} details`}
            data-testid="project-health-row"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                            {snapshot.name}
                        </span>
                        <TooltipProvider delayDuration={200}>
                            <div className="flex flex-wrap items-center gap-1">
                                {highActivity ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge
                                                variant="secondary"
                                                className="px-2 py-0.5 text-[11px]"
                                                aria-label="High Activity"
                                            >
                                                High Activity
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            High activity: elevated open cards or recent attempts
                                            in the selected range.
                                        </TooltipContent>
                                    </Tooltip>
                                ) : null}
                                {highFailureRate ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge
                                                variant="destructive"
                                                className="px-2 py-0.5 text-[11px]"
                                                aria-label="High Failure Rate"
                                            >
                                                High Failure Rate
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            High failure rate:{' '}
                                            {metrics.failedAttemptsInRange} of{' '}
                                            {metrics.attemptsInRange} attempts failed in the
                                            selected range.
                                        </TooltipContent>
                                    </Tooltip>
                                ) : null}
                            </div>
                        </TooltipProvider>
                    </div>
                    {repositoryLabel ? (
                        <div className="text-xs text-muted-foreground">
                            {repositoryLabel}
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-end gap-6 text-xs text-muted-foreground">
                    <div className="text-right">
                        <div>
                            {metrics.openCards} open of {metrics.totalCards} cards
                        </div>
                        {snapshot.columnCardCounts ? (
                            <div className="mt-1 flex flex-wrap justify-end gap-x-2 gap-y-1">
                                <span>Backlog: {snapshot.columnCardCounts.backlog}</span>
                                <span>In progress: {snapshot.columnCardCounts.inProgress}</span>
                                <span>Review: {snapshot.columnCardCounts.review}</span>
                                <span>Done: {snapshot.columnCardCounts.done}</span>
                            </div>
                        ) : null}
                    </div>
                    <div className="text-right">
                        {hasAttemptsInRange ? (
                            <>
                                <div>
                                    {metrics.activeAttempts} active ·{' '}
                                    {metrics.attemptsInRange} in range
                                </div>
                                <div>
                                    {metrics.failedAttemptsInRange} failed (
                                    {formatFailureRatePercentage(metrics.failureRate)})
                                </div>
                            </>
                        ) : (
                            <div>
                                {metrics.activeAttempts} active · No recent attempts
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </li>
    )
}
