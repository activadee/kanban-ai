import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {MetricCards} from './dashboard/MetricCards'
import {StatusBadge} from '@/components/common/StatusBadge'
import {Separator} from '@/components/ui/separator'
import {useDashboardOverview, useDashboardStream, useGithubAuthStatus, useAgents} from '@/hooks'
import {formatRelativeTime} from '@/lib/time'

const relativeTimeFromNow = (value: string | null | undefined) => formatRelativeTime(value) ?? '—'

// Status label and classes handled by StatusBadge

function formatTicket(title: string | null, ticketKey: string | null): string {
    if (ticketKey && title) return `${ticketKey} · ${title}`
    if (ticketKey) return ticketKey
    return title ?? 'Untitled card'
}

export function DashboardPage() {
    const dashboardQuery = useDashboardOverview()
    useDashboardStream(true)
    const githubStatus = useGithubAuthStatus({staleTime: 60_000})
    const agentsQuery = useAgents({staleTime: 60_000})

    const overview = dashboardQuery.data
    const metrics = overview?.metrics
    const activeAttempts = overview?.activeAttempts ?? []
    const recentActivity = overview?.recentAttemptActivity ?? []
    const projectSnapshots = overview?.projectSnapshots ?? []

    const githubConnected = githubStatus.data?.status === 'valid'
    const githubAccount = githubStatus.data && githubStatus.data.status === 'valid' ? githubStatus.data.account : null
    const agentCount = agentsQuery.data?.agents.length ?? 0

    const metricCards = [
        {
            label: 'Projects',
            value: metrics?.totalProjects ?? '—',
            description: 'Boards currently tracked by KanbanAI.',
        },
        {
            label: 'Active Attempts',
            value: metrics?.activeAttempts ?? '—',
            description: 'Agents running or queued across all projects.',
        },
        {
            label: 'Attempts (24h)',
            value: metrics?.attemptsLast24h ?? '—',
            description: 'Completed attempts in the last 24 hours.',
        },
        {
            label: 'Open Cards',
            value: metrics?.openCards ?? '—',
            description: 'Cards not in a Done column.',
        },
    ]

    return (
        <div className="flex h-full flex-col overflow-auto bg-background px-8 py-6">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="flex flex-col gap-4 border-b border-border/60 pb-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Monitor agent activity, recent automation results, and project health at a glance.
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
                        <span className="ml-auto text-xs text-muted-foreground">
              {overview?.updatedAt ? `Updated ${relativeTimeFromNow(overview.updatedAt)}` : dashboardQuery.isFetching ? 'Updating…' : ''}
            </span>
                    </div>
                </header>

                <MetricCards items={metricCards}/>

                <section className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Active Attempts</CardTitle>
                                <CardDescription>Live work that agents are currently processing or queued to
                                    run.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {dashboardQuery.isLoading ? (
                                    <div className="space-y-3">
                                        {Array.from({length: 3}).map((_, index) => (
                                            <div key={index} className="h-14 animate-pulse rounded-md bg-muted/60"/>
                                        ))}
                                    </div>
                                ) : activeAttempts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No active attempts right now. Kick off
                                        work from any card to see it here.</p>
                                ) : (
                                    <ul className="space-y-4">
                                        {activeAttempts.map((attempt) => (
                                            <li key={attempt.attemptId}
                                                className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <StatusBadge status={attempt.status}/>
                                                        <span
                                                            className="text-sm font-medium text-foreground">{formatTicket(attempt.cardTitle, attempt.ticketKey)}</span>
                                                    </div>
                                                    <div
                                                        className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                        <span>{attempt.projectName ?? 'Unknown project'}</span>
                                                        <Separator orientation="vertical" className="h-3"/>
                                                        <span>{attempt.agent}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground">
                                                    <div>{relativeTimeFromNow(attempt.updatedAt)}</div>
                                                    {attempt.projectId ? (
                                                        <Button asChild variant="link" size="sm"
                                                                className="h-auto p-0 text-xs">
                                                            <Link to={`/projects/${attempt.projectId}`}>Open
                                                                project</Link>
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Recent Activity</CardTitle>
                                <CardDescription>Latest attempt outcomes across your projects.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {dashboardQuery.isLoading ? (
                                    <div className="space-y-3">
                                        {Array.from({length: 4}).map((_, index) => (
                                            <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                                        ))}
                                    </div>
                                ) : recentActivity.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No attempt history yet. Launch an agent
                                        attempt to populate this feed.</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {recentActivity.map((activity) => (
                                            <li key={activity.attemptId}
                                                className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <StatusBadge status={activity.status}/>
                                                        <span
                                                            className="text-sm font-medium text-foreground">{formatTicket(activity.cardTitle, activity.ticketKey)}</span>
                                                    </div>
                                                    <div
                                                        className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                        <span>{activity.projectName ?? 'Unknown project'}</span>
                                                        <Separator orientation="vertical" className="h-3"/>
                                                        <span>{activity.agent}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground">
                                                    <div>{relativeTimeFromNow(activity.finishedAt)}</div>
                                                    {activity.projectId ? (
                                                        <Button asChild variant="link" size="sm"
                                                                className="h-auto p-0 text-xs">
                                                            <Link to={`/projects/${activity.projectId}`}>View
                                                                board</Link>
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="border-border/70 bg-card/60">
                            <CardHeader>
                                <CardTitle>Project Snapshot</CardTitle>
                                <CardDescription>Projects with card and attempt counts.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {dashboardQuery.isLoading ? (
                                    <div className="space-y-3">
                                        {Array.from({length: 4}).map((_, index) => (
                                            <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                                        ))}
                                    </div>
                                ) : projectSnapshots.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Create a project to populate this
                                        list.</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {projectSnapshots.map((project) => (
                                            <li key={project.id} className="rounded-md border border-border/60 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <Link to={`/projects/${project.id}`}
                                                              className="text-sm font-medium text-foreground hover:underline">
                                                            {project.name}
                                                        </Link>
                                                        <div
                                                            className="text-xs text-muted-foreground">{project.repositorySlug ?? project.repositoryPath}</div>
                                                    </div>
                                                    <div className="text-right text-xs text-muted-foreground">
                                                        <div>{project.totalCards} cards</div>
                                                        <div>{project.openCards} open · {project.activeAttempts} active
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
                                <CardTitle>System Status</CardTitle>
                                <CardDescription>Connection health and available agents.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="rounded-md border border-border/60 p-3">
                                    <div className="font-medium text-foreground">GitHub</div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {githubStatus.isLoading
                                            ? 'Checking status…'
                                            : githubConnected
                                                ? `Connected as ${githubAccount?.username}`
                                                : 'Not connected. Start the device flow from project onboarding.'}
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
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>
        </div>
    )
}
