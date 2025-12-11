import {useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {DEFAULT_DASHBOARD_TIME_RANGE_PRESET, type DashboardTimeRangePreset} from 'shared'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {MetricCards} from './dashboard/MetricCards'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {
    useDashboardOverview,
    useDashboardStream,
    useGithubAuthStatus,
    useAgents,
} from '@/hooks'
import {deriveDashboardKpiMetrics} from '@/hooks'
import {VersionIndicator} from '@/components/system/VersionIndicator'
import {LiveAgentActivityPanel} from '@/pages/dashboard/LiveAgentActivityPanel'
import {InboxPanel} from '@/pages/dashboard/InboxPanel'
import {useRelativeTimeFormatter} from '@/hooks'
import {ProjectHealthPanel} from '@/pages/dashboard/ProjectHealthPanel'

const formatSuccessRate = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return '—'
    const percentage = value * 100
    if (!Number.isFinite(percentage)) return '—'
    return `${percentage.toFixed(1)}%`
}

const TIME_RANGE_OPTIONS: {preset: DashboardTimeRangePreset; label: string}[] = [
    {preset: 'last_24h', label: 'Last 24 hours'},
    {preset: 'last_7d', label: 'Last 7 days'},
    {preset: 'last_30d', label: 'Last 30 days'},
]

const getTimeRangeLabel = (preset: DashboardTimeRangePreset | undefined): string => {
    const option = TIME_RANGE_OPTIONS.find((item) => item.preset === preset)
    return option?.label ?? 'Selected range'
}

export function DashboardPage() {
    const navigate = useNavigate()
    const [timeRangePreset, setTimeRangePreset] = useState<DashboardTimeRangePreset>(
        DEFAULT_DASHBOARD_TIME_RANGE_PRESET,
    )

    const dashboardQuery = useDashboardOverview({timeRangePreset})
    const dashboardStream = useDashboardStream(timeRangePreset === DEFAULT_DASHBOARD_TIME_RANGE_PRESET)
    const githubStatus = useGithubAuthStatus({staleTime: 60_000})
    const agentsQuery = useAgents({staleTime: 60_000})

    const relativeTimeFromNow = useRelativeTimeFormatter(30_000)

    const overview = dashboardQuery.data
    const activeAttempts = overview?.activeAttempts ?? []
    const recentActivity = overview?.recentAttemptActivity ?? []
    const projectSnapshots = overview?.projectSnapshots ?? []
    const agentStats = overview?.agentStats ?? []
    const inbox = overview?.inboxItems
    const availablePresets = overview?.meta?.availableTimeRangePresets
    const timeRangeOptions = availablePresets
        ? TIME_RANGE_OPTIONS.filter((option) => availablePresets.includes(option.preset))
        : TIME_RANGE_OPTIONS
    const effectiveTimeRangePreset: DashboardTimeRangePreset =
        overview?.timeRange.preset ?? timeRangePreset

    const githubConnected = githubStatus.data?.status === 'valid'
    const githubAccount = githubStatus.data && githubStatus.data.status === 'valid' ? githubStatus.data.account : null
    const agentCount = agentsQuery.data?.agents.length ?? 0

    const timeRangeLabel = getTimeRangeLabel(effectiveTimeRangePreset)

    const kpiMetrics = overview ? deriveDashboardKpiMetrics(overview) : undefined
    const activeAttemptsCount = kpiMetrics?.activeAttempts
    const attemptsInRangeValue = kpiMetrics?.attemptsInRange
    const successRateInRangeValue = kpiMetrics?.successRateInRange
    const reviewItemsCount = kpiMetrics?.reviewItemsCount
    const projectsWithActivityValue = kpiMetrics?.projectsWithActivity

    const hasOverview = overview != null
    const kpiDataUnavailable = dashboardQuery.isError && !hasOverview
    const activityLoadError = dashboardQuery.isError && !hasOverview
    const inboxLoadError = dashboardQuery.isError && !hasOverview

    const metricCards = [
        {
            label: 'Active attempts',
            value:
                dashboardQuery.isLoading || kpiDataUnavailable
                    ? '—'
                    : activeAttemptsCount ?? '—',
            helperText: 'Currently in progress',
        },
        {
            label: 'Attempts in range',
            value:
                dashboardQuery.isLoading || kpiDataUnavailable
                    ? '—'
                    : attemptsInRangeValue ?? '—',
            helperText: 'Within selected period',
        },
        {
            label: 'Success rate',
            value:
                dashboardQuery.isLoading || kpiDataUnavailable
                    ? '—'
                    : formatSuccessRate(successRateInRangeValue),
            helperText: timeRangeLabel,
        },
        {
            label: 'Items to review',
            value:
                dashboardQuery.isLoading || kpiDataUnavailable
                    ? '—'
                    : reviewItemsCount ?? '—',
            helperText: 'From review inbox',
        },
    ]

    if (dashboardQuery.isLoading) {
        metricCards.push({
            label: 'Active projects',
            value: '—',
            helperText: 'With activity in range',
        })
    } else if (projectsWithActivityValue != null) {
        metricCards.push({
            label: 'Active projects',
            value: projectsWithActivityValue,
            helperText: 'With activity in range',
        })
    }

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
                                        {timeRangeOptions.map((option) => (
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

                {dashboardQuery.isError ? (
                    <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        Unable to load KPIs. Showing last known values when available.
                    </div>
                ) : null}

                <MetricCards items={metricCards} isLoading={dashboardQuery.isLoading}/>

                <section className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-6">
                        <LiveAgentActivityPanel
                            activeAttempts={activeAttempts}
                            recentActivity={recentActivity}
                            agents={agentsQuery.data?.agents}
                            isLoading={dashboardQuery.isLoading}
                            timeRangeLabel={timeRangeLabel}
                            updatedLabel={relativeTimeFromNow}
                            streamStatus={dashboardStream?.status ?? 'idle'}
                            hasError={activityLoadError}
                            onRetry={dashboardQuery.refetch}
                            onAttemptNavigate={(attemptId) => {
                                navigate(`/attempts/${attemptId}`)
                            }}
                        />

                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Inbox</CardTitle>
                                <CardDescription>
                                    Actionable items that may need review or intervention.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <InboxPanel
                                    inbox={inbox}
                                    isLoading={dashboardQuery.isLoading}
                                    hasError={inboxLoadError}
                                    onReload={dashboardQuery.refetch}
                                    formatTime={relativeTimeFromNow}
                                    onAttemptNavigate={(attemptId) => {
                                        navigate(`/attempts/${attemptId}`)
                                    }}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <ProjectHealthPanel
                            snapshots={projectSnapshots}
                            isLoading={dashboardQuery.isLoading}
                            onProjectNavigate={(projectId) => {
                                navigate(`/projects/${projectId}`)
                            }}
                        />

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
