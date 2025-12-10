import {useState} from 'react'
import {Link} from 'react-router-dom'
import {DASHBOARD_METRIC_KEYS, type DashboardTimeRangePreset} from 'shared'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {MetricCards} from './dashboard/MetricCards'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Separator} from '@/components/ui/separator'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {useDashboardOverview, useDashboardStream, useGithubAuthStatus, useAgents} from '@/hooks'
import {formatRelativeTime} from '@/lib/time'
import {VersionIndicator} from '@/components/system/VersionIndicator'

const relativeTimeFromNow = (value: string | null | undefined) => formatRelativeTime(value) ?? '—'

const formatSuccessRate = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return '—'
    const percentage = value * 100
    if (!Number.isFinite(percentage)) return '—'
    return `${percentage.toFixed(1)}%`
}

const DEFAULT_TIME_RANGE_PRESET: DashboardTimeRangePreset = 'last_7d'

const TIME_RANGE_OPTIONS: {preset: DashboardTimeRangePreset; label: string}[] = [
    {preset: 'last_24h', label: 'Last 24 hours'},
    {preset: 'last_7d', label: 'Last 7 days'},
    {preset: 'last_30d', label: 'Last 30 days'},
]

const getTimeRangeLabel = (preset: DashboardTimeRangePreset | undefined): string => {
    const option = TIME_RANGE_OPTIONS.find((item) => item.preset === preset)
    return option?.label ?? 'Selected range'
}

// Status label and classes handled by StatusBadge

function formatTicket(title: string | null, ticketKey: string | null): string {
    if (ticketKey && title) return `${ticketKey} · ${title}`
    if (ticketKey) return ticketKey
    return title ?? 'Untitled card'
}

export function DashboardPage() {
    const [timeRangePreset, setTimeRangePreset] = useState<DashboardTimeRangePreset>(DEFAULT_TIME_RANGE_PRESET)

    const dashboardQuery = useDashboardOverview({timeRangePreset})
    useDashboardStream(timeRangePreset === DEFAULT_TIME_RANGE_PRESET)
    const githubStatus = useGithubAuthStatus({staleTime: 60_000})
    const agentsQuery = useAgents({staleTime: 60_000})

    const overview = dashboardQuery.data
    const metrics = overview?.metrics
    const activeAttempts = overview?.activeAttempts ?? []
    const recentActivity = overview?.recentAttemptActivity ?? []
    const projectSnapshots = overview?.projectSnapshots ?? []
    const agentStats = overview?.agentStats ?? []
    const inbox = overview?.inboxItems
    const effectiveTimeRangePreset: DashboardTimeRangePreset = timeRangePreset
    const inboxReview = inbox?.review ?? []
    const inboxFailed = inbox?.failed ?? []
    const inboxStuck = inbox?.stuck ?? []
    const inboxTotal = inboxReview.length + inboxFailed.length + inboxStuck.length

    const githubConnected = githubStatus.data?.status === 'valid'
    const githubAccount = githubStatus.data && githubStatus.data.status === 'valid' ? githubStatus.data.account : null
    const agentCount = agentsQuery.data?.agents.length ?? 0

    const timeRangeLabel = getTimeRangeLabel(effectiveTimeRangePreset)

    const metricCards = [
        {
            label: 'Projects',
            value: metrics?.byKey[DASHBOARD_METRIC_KEYS.projectsTotal]?.total ?? '—',
            description: 'Boards currently tracked by KanbanAI.',
        },
        {
            label: 'Active Attempts',
            value: metrics?.byKey[DASHBOARD_METRIC_KEYS.activeAttempts]?.total ?? '—',
            description: 'Agents running or queued across all projects.',
        },
        {
            label: `Attempts (${timeRangeLabel})`,
            value: metrics?.byKey[DASHBOARD_METRIC_KEYS.attemptsCompleted]?.total ?? '—',
            description: 'Completed attempts in the selected time range.',
        },
        {
            label: 'Open Cards',
            value: metrics?.byKey[DASHBOARD_METRIC_KEYS.openCards]?.total ?? '—',
            description: 'Cards not in a Done column.',
        },
    ]

    return (
        <div className="flex h-full flex-col overflow-auto bg-background px-8 py-6">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="flex flex-col gap-4 border-b border-border/60 pb-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold text-foreground">Mission Control</h1>
                            <VersionIndicator/>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Centralize agent activity, project health, and system status in one dashboard.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm">
                            <Link to="/projects">View projects</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                            <Link to="/settings">App settings</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                            <Link to="/agents/CODEX">Manage agents</Link>
                        </Button>
                        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <span>Time range</span>
                                <Select
                                    value={effectiveTimeRangePreset}
                                    onValueChange={(value) => setTimeRangePreset(value as DashboardTimeRangePreset)}
                                >
                                    <SelectTrigger size="sm">
                                        <SelectValue placeholder="Select range"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIME_RANGE_OPTIONS.map((option) => (
                                            <SelectItem key={option.preset} value={option.preset}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <span>
                                {overview?.generatedAt || overview?.updatedAt
                                    ? `Updated ${relativeTimeFromNow(overview.generatedAt ?? overview.updatedAt)}`
                                    : dashboardQuery.isFetching
                                        ? 'Updating…'
                                        : ''}
                            </span>
                        </div>
                    </div>
                </header>

                <MetricCards items={metricCards}/>

                <section className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-6">
                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Live Agent Activity</CardTitle>
                                <CardDescription>
                                    Live attempts and recent outcomes across your projects.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <h2 className="text-sm font-medium text-foreground">Active attempts</h2>
                                    </div>
                                    {dashboardQuery.isLoading ? (
                                        <div className="space-y-3">
                                            {Array.from({length: 3}).map((_, index) => (
                                                <div key={index} className="h-14 animate-pulse rounded-md bg-muted/60"/>
                                            ))}
                                        </div>
                                    ) : activeAttempts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No active attempts right now. Kick off work from any card to see it here.
                                        </p>
                                    ) : (
                                        <ul className="space-y-4">
                                            {activeAttempts.map((attempt) => (
                                                <li
                                                    key={attempt.attemptId}
                                                    className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <StatusBadge status={attempt.status}/>
                                                            <span className="text-sm font-medium text-foreground">
                                                                {formatTicket(attempt.cardTitle, attempt.ticketKey)}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{attempt.projectName ?? 'Unknown project'}</span>
                                                            <Separator orientation="vertical" className="h-3"/>
                                                            <span>{attempt.agentId}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-xs text-muted-foreground">
                                                        <div>{relativeTimeFromNow(attempt.updatedAt)}</div>
                                                        {attempt.projectId ? (
                                                            <Button
                                                                asChild
                                                                variant="link"
                                                                size="sm"
                                                                className="h-auto p-0 text-xs"
                                                            >
                                                                <Link to={`/projects/${attempt.projectId}`}>
                                                                    Open project
                                                                </Link>
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
                                        <span className="text-xs text-muted-foreground">{timeRangeLabel}</span>
                                    </div>
                                    {dashboardQuery.isLoading ? (
                                        <div className="space-y-3">
                                            {Array.from({length: 4}).map((_, index) => (
                                                <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                                            ))}
                                        </div>
                                    ) : recentActivity.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No attempt history yet. Launch an agent attempt to populate this feed.
                                        </p>
                                    ) : (
                                        <ul className="space-y-3">
                                            {recentActivity.map((activity) => (
                                                <li
                                                    key={activity.attemptId}
                                                    className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <StatusBadge status={activity.status}/>
                                                            <span className="text-sm font-medium text-foreground">
                                                                {formatTicket(activity.cardTitle, activity.ticketKey)}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{activity.projectName ?? 'Unknown project'}</span>
                                                            <Separator orientation="vertical" className="h-3"/>
                                                            <span>{activity.agentId}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-xs text-muted-foreground">
                                                        <div>{relativeTimeFromNow(activity.occurredAt)}</div>
                                                        {activity.projectId ? (
                                                            <Button
                                                                asChild
                                                                variant="link"
                                                                size="sm"
                                                                className="h-auto p-0 text-xs"
                                                            >
                                                                <Link to={`/projects/${activity.projectId}`}>
                                                                    View board
                                                                </Link>
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Inbox</CardTitle>
                                <CardDescription>
                                    Actionable items that may need review or intervention.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {dashboardQuery.isLoading ? (
                                    <div className="space-y-3">
                                        {Array.from({length: 4}).map((_, index) => (
                                            <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                                        ))}
                                    </div>
                                ) : inboxTotal === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No inbox items in the selected time range.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {(['review', 'failed', 'stuck'] as const).map((kind) => {
                                            const items =
                                                kind === 'review'
                                                    ? inboxReview
                                                    : kind === 'failed'
                                                        ? inboxFailed
                                                        : inboxStuck
                                            if (!items.length) return null
                                            const label =
                                                kind === 'review' ? 'Review' : kind === 'failed' ? 'Failed' : 'Stuck'
                                            return (
                                                <div key={kind} className="space-y-2">
                                                    <div
                                                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        {label}
                                                    </div>
                                                    <ul className="space-y-2">
                                                        {items.map((item) => (
                                                            <li
                                                                key={item.id}
                                                                className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3 text-xs"
                                                            >
                                                                <div className="space-y-1">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span
                                                                            className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                                                                        >
                                                                            {label}
                                                                        </span>
                                                                        <span
                                                                            className="text-sm font-medium text-foreground">
                                                                            {formatTicket(
                                                                                item.cardTitle ?? null,
                                                                                item.ticketKey ?? null,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                                        <span>
                                                                            {item.projectName ?? 'Unknown project'}
                                                                        </span>
                                                                        {(item.agentName || item.agentId) && (
                                                                            <>
                                                                                <Separator
                                                                                    orientation="vertical"
                                                                                    className="h-3"
                                                                                />
                                                                                <span>
                                                                                    {item.agentName ?? item.agentId}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className="text-right text-[11px] text-muted-foreground">
                                                                    <div>
                                                                        {relativeTimeFromNow(
                                                                            item.lastUpdatedAt ??
                                                                            item.finishedAt ??
                                                                            item.updatedAt ??
                                                                            item.createdAt,
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Project Health</CardTitle>
                                <CardDescription>
                                    Project workload and card counts in the selected time range.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {dashboardQuery.isLoading ? (
                                    <div className="space-y-3">
                                        {Array.from({length: 4}).map((_, index) => (
                                            <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                                        ))}
                                    </div>
                                ) : projectSnapshots.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Create a project to populate this list.
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {projectSnapshots.map((project) => (
                                            <li key={project.id} className="rounded-md border border-border/60 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <Link
                                                            to={`/projects/${project.id}`}
                                                            className="text-sm font-medium text-foreground hover:underline"
                                                        >
                                                            {project.name}
                                                        </Link>
                                                        <div className="text-xs text-muted-foreground">
                                                            {project.repositorySlug ?? project.repositoryPath}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-xs text-muted-foreground">
                                                        <div>{project.totalCards} cards</div>
                                                        <div>
                                                            {project.openCards} open · {project.activeAttempts} active
                                                            attempts
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Agents &amp; System</CardTitle>
                                <CardDescription>
                                    GitHub connection and per-agent activity for this time range.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="rounded-md border border-border/60 p-3">
                                    <div className="font-medium text-foreground">GitHub</div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {githubStatus.isLoading
                                            ? 'Checking status…'
                                            : githubConnected
                                                ? `Connected as ${githubAccount?.username}`
                                                : 'Not connected. Open onboarding or Settings → GitHub to connect.'}
                                    </p>
                                </div>
                                <div className="rounded-md border border-border/60 p-3">
                                    <div className="font-medium text-foreground">Agents</div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {agentsQuery.isLoading
                                            ? 'Loading agents…'
                                            : agentCount === 0
                                                ? 'No agents registered. Add one under Agents settings.'
                                                : `${agentCount} agent${agentCount === 1 ? '' : 's'} available.`}
                                    </p>
                                    <div className="mt-3 space-y-2">
                                        {dashboardQuery.isLoading ? (
                                            <div className="space-y-2">
                                                {Array.from({length: 2}).map((_, index) => (
                                                    <div
                                                        key={index}
                                                        className="h-8 animate-pulse rounded-md bg-muted/60"
                                                    />
                                                ))}
                                            </div>
                                        ) : agentStats.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">
                                                {agentCount === 0
                                                    ? 'Register an agent to start collecting activity.'
                                                    : 'No attempts in the selected time range yet.'}
                                            </p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {agentStats.map((stat) => {
                                                    const attemptsInRange = stat.attemptsInRange ?? 0
                                                    const hasActivity =
                                                        stat.hasActivityInRange ?? attemptsInRange > 0
                                                    return (
                                                        <li
                                                            key={stat.agentId}
                                                            className={`flex items-center justify-between rounded-md border px-2 py-1 text-xs ${
                                                                hasActivity
                                                                    ? 'border-border/70 bg-background/40'
                                                                    : 'border-dashed border-border/60 bg-muted/40'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-foreground">
                                                                    {stat.agentName || stat.agentId}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {hasActivity
                                                                        ? `${attemptsInRange} attempt${attemptsInRange === 1 ? '' : 's'} in range · ${formatSuccessRate(stat.successRateInRange)}`
                                                                        : 'No attempts in selected time range'}
                                                                </span>
                                                            </div>
                                                            <div className="text-right text-[11px] text-muted-foreground">
                                                                {hasActivity ? (
                                                                    <div>
                                                                        Last activity{' '}
                                                                        {relativeTimeFromNow(
                                                                            stat.lastActivityAt ?? null,
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div>Inactive in this range</div>
                                                                )}
                                                            </div>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>
        </div>
    )
}
