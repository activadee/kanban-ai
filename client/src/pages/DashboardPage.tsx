import {useEffect, useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {DEFAULT_DASHBOARD_TIME_RANGE_PRESET, type DashboardTimeRangePreset} from 'shared'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {MetricCards} from './dashboard/MetricCards'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {
    useDashboardOverview,
    useDashboardStream,
} from '@/hooks'
import {deriveDashboardKpiMetrics} from '@/hooks'
import {VersionIndicator} from '@/components/system/VersionIndicator'
import {LiveAgentActivityPanel} from '@/pages/dashboard/LiveAgentActivityPanel'
import {InboxPanel} from '@/pages/dashboard/InboxPanel'
import {useRelativeTimeFormatter} from '@/hooks'
import {ProjectHealthPanel} from '@/pages/dashboard/ProjectHealthPanel'
import {AgentsSystemStatusPanel} from '@/pages/dashboard/AgentsSystemStatusPanel'
import {RecentAttemptHistoryPanel} from '@/pages/dashboard/RecentAttemptHistoryPanel'
import {formatSuccessRate} from '@/pages/dashboard/formatters'
import {
    SectionEmptyState,
    SectionErrorBanner,
    type SectionState,
} from '@/pages/dashboard/SectionState'

const TIME_RANGE_OPTIONS: {preset: DashboardTimeRangePreset; label: string}[] = [
    {preset: 'last_24h', label: 'Last 24 hours'},
    {preset: 'last_7d', label: 'Last 7 days'},
    {preset: 'last_30d', label: 'Last 30 days'},
]

const DASHBOARD_TIME_RANGE_STORAGE_KEY = 'dashboard.timeRangePreset'

function resolveTimeRangePresetFromStorage(): DashboardTimeRangePreset | undefined {
    if (typeof window === 'undefined') return undefined
    try {
        const raw = window.sessionStorage.getItem(DASHBOARD_TIME_RANGE_STORAGE_KEY)
        if (raw === 'last_24h' || raw === 'last_7d' || raw === 'last_30d') {
            return raw
        }
    } catch {
        // Best-effort persistence; ignore storage errors.
    }
    return undefined
}

function storeTimeRangePreset(value: DashboardTimeRangePreset) {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(DASHBOARD_TIME_RANGE_STORAGE_KEY, value)
    } catch {
        // Best-effort persistence; ignore storage errors.
    }
}

const getTimeRangeLabel = (preset: DashboardTimeRangePreset | undefined): string => {
    const option = TIME_RANGE_OPTIONS.find((item) => item.preset === preset)
    return option?.label ?? 'Selected range'
}

export function DashboardPage() {
    const navigate = useNavigate()
    const [timeRangePreset, setTimeRangePreset] = useState<DashboardTimeRangePreset>(() => {
        const stored = resolveTimeRangePresetFromStorage()
        return stored ?? DEFAULT_DASHBOARD_TIME_RANGE_PRESET
    })

    useEffect(() => {
        storeTimeRangePreset(timeRangePreset)
    }, [timeRangePreset])

    const dashboardQuery = useDashboardOverview({timeRangePreset})
    const dashboardStream = useDashboardStream(timeRangePreset === DEFAULT_DASHBOARD_TIME_RANGE_PRESET)

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

    const hasAnyKpiData =
        (activeAttemptsCount ?? 0) > 0 ||
        (attemptsInRangeValue ?? 0) > 0 ||
        (successRateInRangeValue ?? 0) > 0 ||
        (reviewItemsCount ?? 0) > 0 ||
        (projectsWithActivityValue ?? 0) > 0

    const kpiSectionState: SectionState =
        dashboardQuery.isLoading
            ? 'loading'
            : kpiDataUnavailable
                ? 'error'
                : hasAnyKpiData
                    ? 'success'
                    : 'empty'

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
        <div className="flex h-full flex-col overflow-auto bg-background px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
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
                    <SectionErrorBanner
                        className="mb-2"
                        title="Unable to load KPIs."
                        description="Showing last known values when available. Retry to refresh the dashboard snapshot."
                        onRetry={dashboardQuery.refetch}
                    />
                ) : null}

                <MetricCards items={metricCards} isLoading={dashboardQuery.isLoading}/>

                {kpiSectionState === 'empty' && !dashboardQuery.isError && !dashboardQuery.isLoading ? (
                    <SectionEmptyState
                        data-testid="kpi-empty-state"
                        title="No dashboard activity yet."
                        description="Once agents start running attempts, key metrics for this time range will appear here."
                    />
                ) : null}

                <section
                    className="grid gap-6 xl:grid-cols-2"
                    data-testid="mission-control-grid"
                >
                    <div className="space-y-6">
                        <LiveAgentActivityPanel
                            activeAttempts={activeAttempts}
                            recentActivity={recentActivity}
                            agents={undefined}
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
                    </div>

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

                    <ProjectHealthPanel
                        snapshots={projectSnapshots}
                        isLoading={dashboardQuery.isLoading}
                        hasError={dashboardQuery.isError && !hasOverview}
                        onRetry={dashboardQuery.refetch}
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
                        <CardContent>
                            <AgentsSystemStatusPanel
                                agentStats={agentStats}
                                isDashboardLoading={dashboardQuery.isLoading}
                                hasDashboardError={dashboardQuery.isError && !hasOverview}
                                timeRangeLabel={timeRangeLabel}
                                formatRelativeTime={relativeTimeFromNow}
                                onRetryDashboard={dashboardQuery.refetch}
                            />
                        </CardContent>
                    </Card>

                    <div className="space-y-6 xl:col-span-2">
                        <RecentAttemptHistoryPanel
                            attempts={recentActivity}
                            isLoading={dashboardQuery.isLoading && !hasOverview}
                            hasError={activityLoadError}
                            timeRangeLabel={timeRangeLabel}
                            formatRelativeTime={relativeTimeFromNow}
                            onRetry={dashboardQuery.refetch}
                            onAttemptNavigate={(attemptId) => {
                                navigate(`/attempts/${attemptId}`)
                            }}
                        />
                    </div>
                </section>
            </div>
        </div>
    )
}
