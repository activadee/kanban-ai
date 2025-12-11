import {useMemo, useState} from 'react'
import type {
    ActiveAttemptSummary,
    AgentSummary,
    AttemptActivityItem,
} from 'shared'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {ActiveAttemptsList} from './ActiveAttemptsList'
import {RecentActivityList} from './RecentActivityList'
import type {DashboardStreamStatus} from '@/hooks'

type Props = {
    activeAttempts: ActiveAttemptSummary[]
    recentActivity: AttemptActivityItem[]
    agents?: AgentSummary[]
    isLoading: boolean
    timeRangeLabel: string
    updatedLabel: (value: string | null | undefined) => string
    streamStatus: DashboardStreamStatus
    hasError: boolean
    onRetry: () => void
    onAttemptNavigate?: (attemptId: string) => void
}

type StatusFilter = 'all' | 'queued' | 'running' | 'stopping'

type AgentOption = {
    id: string
    label: string
}

type ProjectOption = {
    id: string
    label: string
}

function resolveAgentLabel(agentId: string, agents?: AgentSummary[]): string {
    if (!agents || agents.length === 0) return agentId
    const match = agents.find((agent) => agent.key === agentId)
    return match?.label ?? agentId
}

export function LiveAgentActivityPanel({
                                           activeAttempts,
                                           recentActivity,
                                           agents,
                                           isLoading,
                                           timeRangeLabel,
                                           updatedLabel,
                                           streamStatus,
                                           hasError,
                                           onRetry,
                                           onAttemptNavigate,
                                       }: Props) {
    const [agentFilter, setAgentFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [projectFilter, setProjectFilter] = useState<string>('all')

    const agentOptions: AgentOption[] = useMemo(() => {
        const ids = new Set<string>()
        for (const attempt of activeAttempts) {
            if (attempt.agentId) {
                ids.add(attempt.agentId)
            }
        }
        const options: AgentOption[] = []
        for (const id of ids) {
            options.push({id, label: resolveAgentLabel(id, agents)})
        }
        options.sort((a, b) => a.label.localeCompare(b.label))
        return options
    }, [activeAttempts, agents])

    const projectOptions: ProjectOption[] = useMemo(() => {
        const ids = new Map<string, string>()
        for (const attempt of activeAttempts) {
            if (!attempt.projectId) continue
            if (!ids.has(attempt.projectId)) {
                ids.set(attempt.projectId, attempt.projectName ?? attempt.projectId)
            }
        }
        const options: ProjectOption[] = []
        for (const [id, label] of ids.entries()) {
            options.push({id, label})
        }
        options.sort((a, b) => a.label.localeCompare(b.label))
        return options
    }, [activeAttempts])

    const filteredAttempts = useMemo(() => {
        return activeAttempts.filter((attempt) => {
            const matchesAgent =
                agentFilter === 'all' || attempt.agentId === agentFilter
            const matchesStatus =
                statusFilter === 'all' || attempt.status === statusFilter
            const matchesProject =
                projectFilter === 'all' ||
                (attempt.projectId != null && attempt.projectId === projectFilter)

            return matchesAgent && matchesStatus && matchesProject
        })
    }, [activeAttempts, agentFilter, statusFilter, projectFilter])

    const activeFilterCount =
        (agentFilter === 'all' ? 0 : 1) +
        (statusFilter === 'all' ? 0 : 1) +
        (projectFilter === 'all' ? 0 : 1)

    const hasActiveFilters = activeFilterCount > 0
    const hasAttempts = activeAttempts.length > 0
    const hasFilteredAttempts = filteredAttempts.length > 0
    const filterMatchesNone = hasAttempts && !isLoading && !hasFilteredAttempts

    const websocketIssue =
        streamStatus === 'error' || streamStatus === 'reconnecting'

    const attemptRows = filteredAttempts.map((attempt) => ({
        attemptId: attempt.attemptId,
        status: attempt.status,
        cardTitle: attempt.cardTitle,
        ticketKey: attempt.ticketKey,
        projectName: attempt.projectName,
        projectId: attempt.projectId,
        startedAt: attempt.startedAt,
        updatedAt: attempt.updatedAt,
        agent: resolveAgentLabel(attempt.agentId, agents),
    }))

    const recentRows = recentActivity.map((activity) => ({
        attemptId: activity.attemptId,
        status: activity.status,
        cardTitle: activity.cardTitle,
        ticketKey: activity.ticketKey,
        projectName: activity.projectName,
        projectId: activity.projectId,
        finishedAt: activity.occurredAt,
        agent: resolveAgentLabel(activity.agentId, agents),
    }))

    const handleClearFilters = () => {
        setAgentFilter('all')
        setStatusFilter('all')
        setProjectFilter('all')
    }

    return (
        <Card className="border-border/70 bg-card/60">
            <CardHeader>
                <CardTitle>Live Agent Activity</CardTitle>
                <CardDescription>
                    Live attempts and recent outcomes across your projects.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {hasError && !isLoading && !hasAttempts ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>Unable to load live agent activity.</span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-6 border-destructive/60 px-2 text-[11px]"
                                onClick={onRetry}
                            >
                                Retry
                            </Button>
                        </div>
                        <p className="mt-1 text-[11px] text-destructive/80">
                            Showing the latest known data when available.
                        </p>
                    </div>
                ) : null}

                <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-sm font-medium text-foreground">
                            Active attempts
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={agentFilter}
                                    onValueChange={(value) => setAgentFilter(value)}
                                >
                                    <SelectTrigger
                                        aria-label="Filter by agent"
                                        className="h-8 w-[160px] text-xs"
                                    >
                                        <SelectValue placeholder="All agents"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All agents</SelectItem>
                                        {agentOptions.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                {agent.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={statusFilter}
                                    onValueChange={(value) =>
                                        setStatusFilter(value as StatusFilter)
                                    }
                                >
                                    <SelectTrigger
                                        aria-label="Filter by status"
                                        className="h-8 w-[140px] text-xs"
                                    >
                                        <SelectValue placeholder="All statuses"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="running">Running</SelectItem>
                                        <SelectItem value="queued">Queued</SelectItem>
                                        <SelectItem value="stopping">Stopping</SelectItem>
                                    </SelectContent>
                                </Select>
                                {projectOptions.length > 1 ? (
                                    <Select
                                        value={projectFilter}
                                        onValueChange={(value) => setProjectFilter(value)}
                                    >
                                        <SelectTrigger
                                            aria-label="Filter by project"
                                            className="h-8 w-[180px] text-xs"
                                        >
                                            <SelectValue placeholder="All projects"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All projects</SelectItem>
                                            {projectOptions.map((project) => (
                                                <SelectItem key={project.id} value={project.id}>
                                                    {project.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : null}
                            </div>
                            {hasActiveFilters ? (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={handleClearFilters}
                                    >
                                        Clear filters
                                    </Button>
                                    <Badge className="h-6 px-2 text-[11px]">
                                        {activeFilterCount} filter
                                        {activeFilterCount === 1 ? '' : 's'}
                                    </Badge>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {websocketIssue ? (
                        <div className="mb-2 text-xs text-muted-foreground">
                            Live updates temporarily unavailable. Showing latest known data.
                        </div>
                    ) : null}

                    {isLoading ? (
                        <ActiveAttemptsList
                            attempts={[]}
                            isLoading
                            updatedLabel={updatedLabel}
                            onSelectAttempt={onAttemptNavigate}
                        />
                    ) : filterMatchesNone ? (
                        <p className="text-sm text-muted-foreground">
                            No active attempts match the current filters.
                        </p>
                    ) : hasAttempts ? (
                        <ActiveAttemptsList
                            attempts={attemptRows}
                            isLoading={false}
                            updatedLabel={updatedLabel}
                            onSelectAttempt={onAttemptNavigate}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No active attempts right now. Kick off work from any card to see it here.
                        </p>
                    )}
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
                        <span className="text-xs text-muted-foreground">{timeRangeLabel}</span>
                    </div>
                    <RecentActivityList
                        items={recentRows}
                        isLoading={isLoading}
                        finishedLabel={updatedLabel}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
