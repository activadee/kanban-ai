import {Link} from 'react-router-dom'
import type {AgentStatsSummary} from 'shared'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {GitHubIcon} from '@/components/icons/SimpleIcons'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {useGithubAuthStatus, useAgents} from '@/hooks'
import {formatSuccessRate} from './formatters'

type Props = {
    agentStats: AgentStatsSummary[]
    isDashboardLoading: boolean
    hasDashboardError: boolean
    timeRangeLabel: string
    formatRelativeTime: (value: string | null | undefined) => string
    onRetryDashboard: () => void
}

type GitHubStatusKind = 'connected' | 'disconnected' | 'error' | 'unknown'

type AgentFleetState = 'active' | 'noAgents' | 'noActivity' | 'loading' | 'error'

type ReadinessTone = 'good' | 'warn' | 'bad'

function describeGithubStatusKind(query: ReturnType<typeof useGithubAuthStatus>): GitHubStatusKind {
    if (query.isError) return 'error'
    const data = query.data
    if (!data) return 'unknown'
    if (data.status === 'valid') return 'connected'
    if (data.status === 'invalid') return 'disconnected'
    return 'unknown'
}

function describeAgentFleetState(
    agentStats: AgentStatsSummary[],
    agentsQuery: ReturnType<typeof useAgents>,
    isDashboardLoading: boolean,
    hasDashboardError: boolean,
): AgentFleetState {
    if (isDashboardLoading || agentsQuery.isLoading) return 'loading'
    if (hasDashboardError && agentStats.length === 0) return 'error'
    if (agentsQuery.isError) return 'error'

    const agentCount = agentsQuery.data?.agents.length ?? 0
    if (agentCount === 0) return 'noAgents'

    if (agentStats.length === 0) return 'noActivity'

    const hasActivity = agentStats.some((stat) => {
        const attemptsInRange = stat.attemptsInRange ?? 0
        return stat.hasActivityInRange === true || attemptsInRange > 0
    })

    return hasActivity ? 'active' : 'noActivity'
}

function getReadinessDescriptor(
    githubStatusKind: GitHubStatusKind,
    agentFleetState: AgentFleetState,
): {label: string; description: string; tone: ReadinessTone} {
    const githubHealthy = githubStatusKind === 'connected'
    const agentsActive = agentFleetState === 'active'
    const agentsConfigured = agentFleetState !== 'noAgents'
    const hasErrors =
        githubStatusKind === 'error' || agentFleetState === 'error'

    if (githubHealthy && agentsActive) {
        return {
            label: 'Ready to work',
            description:
                'GitHub is connected and at least one agent has handled attempts in this time range.',
            tone: 'good',
        }
    }

    const needsSetup =
        !githubHealthy || !agentsConfigured || hasErrors

    if (needsSetup) {
        if (!githubHealthy && !agentsConfigured) {
            return {
                label: 'Action required',
                description:
                    'Connect GitHub and configure at least one agent to start running work.',
                tone: 'bad',
            }
        }
        if (!githubHealthy) {
            return {
                label: 'Action required',
                description: 'Connect GitHub to enable code-aware agents.',
                tone: 'bad',
            }
        }
        if (!agentsConfigured) {
            return {
                label: 'Action required',
                description:
                    'Add and configure at least one agent to start running work.',
                tone: 'bad',
            }
        }
        return {
            label: 'Degraded',
            description:
                'Some status data failed to load. Retry to confirm system health.',
            tone: 'warn',
        }
    }

    return {
        label: 'Idle but configured',
        description:
            'GitHub and agents are configured, but no attempts have run in this time range yet.',
        tone: 'warn',
    }
}

function sortAgentStats(agentStats: AgentStatsSummary[]): AgentStatsSummary[] {
    return agentStats
        .slice()
        .sort((a, b) => {
            const aTs = a.lastActivityAt ? Date.parse(a.lastActivityAt) : NaN
            const bTs = b.lastActivityAt ? Date.parse(b.lastActivityAt) : NaN

            const aValid = Number.isFinite(aTs)
            const bValid = Number.isFinite(bTs)

            if (aValid && bValid) {
                return bTs - aTs
            }
            if (aValid) return -1
            if (bValid) return 1

            const aLabel = a.agentName || a.agentId
            const bLabel = b.agentName || b.agentId
            return aLabel.localeCompare(bLabel)
        })
}

export function AgentsSystemStatusPanel({
                                            agentStats,
                                            isDashboardLoading,
                                            hasDashboardError,
                                            timeRangeLabel,
                                            formatRelativeTime,
                                            onRetryDashboard,
                                        }: Props) {
    const githubStatus = useGithubAuthStatus({staleTime: 60_000})
    const agentsQuery = useAgents({staleTime: 60_000})

    const githubKind = describeGithubStatusKind(githubStatus)
    const agentFleetState = describeAgentFleetState(
        agentStats,
        agentsQuery,
        isDashboardLoading,
        hasDashboardError,
    )

    const readiness = getReadinessDescriptor(githubKind, agentFleetState)

    const agentCount = agentsQuery.data?.agents.length ?? 0
    const sortedAgentStats = sortAgentStats(agentStats)
    const MAX_AGENTS = 8
    const visibleAgentStats = sortedAgentStats.slice(0, MAX_AGENTS)

    const showAgentStatsError =
        !isDashboardLoading &&
        (hasDashboardError && agentStats.length === 0)

    const showAgentStatsDegraded =
        !isDashboardLoading &&
        hasDashboardError &&
        agentStats.length > 0

    const showGithubError = githubStatus.isError
    const showAgentsError = agentsQuery.isError

    const anyAgentActivity = agentFleetState === 'active'

    const readinessBadgeClass =
        readiness.tone === 'good'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100 border-emerald-200/70 dark:border-emerald-800'
            : readiness.tone === 'warn'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 border-amber-200/70 dark:border-amber-800'
                : 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100 border-rose-200/70 dark:border-rose-800'

    const githubStatusLabel =
        githubKind === 'connected'
            ? 'Connected'
            : githubKind === 'disconnected'
                ? 'Not connected'
                : githubKind === 'error'
                    ? 'Error'
                    : 'Unknown'

    const githubDescription = (() => {
        if (githubStatus.isLoading) {
            return 'Checking GitHub connection…'
        }
        if (githubKind === 'connected') {
            const account =
                githubStatus.data?.status === 'valid'
                    ? githubStatus.data.account
                    : null
            if (account?.username) {
                return `Connected as ${account.username}. GitHub events are flowing; agents can see your repos.`
            }
            return 'Connected. GitHub events are flowing; agents can see your repos.'
        }
        if (githubKind === 'disconnected') {
            return 'Connect GitHub to enable code-aware agents and pull request workflows.'
        }
        if (githubKind === 'error') {
            return 'Unable to confirm GitHub status. Retry or check integration settings.'
        }
        return 'GitHub status is currently unknown. Retry if this looks unexpected.'
    })()

    const agentsSummaryDescription = (() => {
        if (agentsQuery.isLoading || isDashboardLoading) {
            return 'Loading agent fleet status…'
        }
        if (agentFleetState === 'noAgents') {
            return 'No agents are registered yet. Configure an agent to start running work.'
        }
        if (agentFleetState === 'noActivity') {
            return 'Agents are configured but have no attempts in the selected time range.'
        }
        if (agentFleetState === 'error') {
            return 'Unable to load full agent fleet status. Retry to refresh this snapshot.'
        }
        const label =
            agentCount === 1 ? '1 agent available.' : `${agentCount} agents available.`
        if (!anyAgentActivity) {
            return label
        }
        return `${label} Showing agents ordered by recent activity for ${timeRangeLabel.toLowerCase()}.`
    })()

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-4 text-sm">
                <section
                    aria-label="System readiness"
                    className="rounded-md border border-border/60 bg-background/50 p-3"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                System readiness
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className={`border px-2 py-0.5 text-[11px] font-medium ${readinessBadgeClass}`}
                                    aria-label={`System readiness: ${readiness.label}`}
                                >
                                    {readiness.label}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                    {readiness.description}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                            >
                                <Link to="/agents/CODEX">View agents</Link>
                            </Button>
                            <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                            >
                                <Link to="/settings">Integration settings</Link>
                            </Button>
                        </div>
                    </div>
                </section>

                <section
                    aria-label="System integrations"
                    className="space-y-3 rounded-md border border-border/60 p-3"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-2">
                            <GitHubIcon className="mt-0.5 size-4" aria-hidden="true"/>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">
                                        GitHub
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                                        aria-label={`GitHub integration status: ${githubStatusLabel}`}
                                    >
                                        {githubStatusLabel}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {githubDescription}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                            {githubKind === 'connected' ? (
                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                >
                                    <Link to="/settings">Manage GitHub</Link>
                                </Button>
                            ) : (
                                <Button
                                    asChild
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                >
                                    <Link to="/onboarding">Connect GitHub</Link>
                                </Button>
                            )}
                            {showGithubError ? (
                                <button
                                    type="button"
                                    onClick={() => githubStatus.refetch()}
                                    className="text-[11px] text-destructive underline"
                                >
                                    Retry GitHub status
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {showGithubError ? (
                        <div
                            className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive"
                            role="status"
                        >
                            Unable to load GitHub integration status. Check your connection and try again.
                        </div>
                    ) : null}
                </section>

                <section
                    aria-label="Agent fleet"
                    className="space-y-3 rounded-md border border-border/60 p-3"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-medium text-foreground">
                                Agent fleet
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                {agentsSummaryDescription}
                            </p>
                        </div>
                        {showAgentStatsDegraded || showAgentsError ? (
                            <div
                                className="ml-auto text-right text-[11px] text-destructive"
                                role="status"
                            >
                                <div>Some agent metrics may be out of date.</div>
                                <button
                                    type="button"
                                    className="mt-1 underline"
                                    onClick={() => {
                                        if (showAgentsError) {
                                            agentsQuery.refetch()
                                        }
                                        onRetryDashboard()
                                    }}
                                >
                                    Retry agent status
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {showAgentStatsError ? (
                        <div
                            className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[11px] text-destructive"
                            role="status"
                        >
                            <div>
                                <div className="font-medium">Unable to load agent stats.</div>
                                <div className="mt-1 opacity-80">
                                    Check your connection and retry the dashboard snapshot.
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-destructive/40 px-2 text-[11px]"
                                onClick={onRetryDashboard}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : isDashboardLoading ? (
                        <div className="space-y-2" aria-label="Loading agent stats">
                            {Array.from({length: 3}).map((_, index) => (
                                <div
                                    key={index}
                                    className="h-8 animate-pulse rounded-md bg-muted/60"
                                />
                            ))}
                        </div>
                    ) : agentStats.length === 0 ? (
                        <div className="space-y-2 text-[11px] text-muted-foreground">
                            {agentFleetState === 'noAgents' ? (
                                <>
                                    <p>No agents are active yet.</p>
                                    <p>
                                        Once you configure agents, their activity and health will appear
                                        here for the selected time range.
                                    </p>
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="mt-1 h-7 px-2 text-[11px]"
                                    >
                                        <Link to="/agents/CODEX">Manage agents</Link>
                                    </Button>
                                </>
                            ) : (
                                <p>
                                    No attempts in the selected time range yet. Once agents start
                                    handling tasks, you&apos;ll see their activity here.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                {visibleAgentStats.map((stat) => {
                                    const attemptsInRange = stat.attemptsInRange ?? 0
                                    const hasActivity =
                                        stat.hasActivityInRange ?? attemptsInRange > 0
                                    const lastActivityLabel =
                                        stat.lastActivityAt != null
                                            ? formatRelativeTime(stat.lastActivityAt)
                                            : 'No recorded activity'
                                    const lastActivityExact =
                                        stat.lastActivityAt ?? 'No recorded activity'
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
                                                        ? `${attemptsInRange} attempt${attemptsInRange === 1 ? '' : 's'} in range · ${formatSuccessRate(
                                                            stat.successRateInRange,
                                                        )}`
                                                        : 'No attempts in selected time range'}
                                                </span>
                                            </div>
                                            <div className="text-right text-[11px] text-muted-foreground">
                                                {hasActivity ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="cursor-default underline-offset-2 hover:underline"
                                                                aria-label={`Last activity ${lastActivityLabel}`}
                                                            >
                                                                Last activity {lastActivityLabel}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <span className="text-xs">
                                                                {lastActivityExact}
                                                            </span>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <div>Inactive in this range</div>
                                                )}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                            {agentStats.length > MAX_AGENTS ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    Showing the {MAX_AGENTS} most recently active agents.
                                </p>
                            ) : null}
                        </div>
                    )}
                </section>
            </div>
        </TooltipProvider>
    )
}

