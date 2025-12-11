import {Link, useParams} from 'react-router-dom'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {StatusBadge} from '@/components/common/StatusBadge'
import {useAttempt, useAttemptLogs, useRelativeTimeFormatter} from '@/hooks'

export function AttemptDetailPage() {
    const {attemptId} = useParams<{ attemptId: string }>()
    const relativeTimeFromNow = useRelativeTimeFormatter(30_000)

    const attemptQuery = useAttempt(attemptId, {})
    const logsQuery = useAttemptLogs(attemptId, {})

    if (!attemptId) {
        return (
            <div className="p-8">
                <p className="text-sm text-destructive">Missing attempt identifier.</p>
                <Button asChild variant="link" className="mt-2 px-0">
                    <Link to="/dashboard">Back to dashboard</Link>
                </Button>
            </div>
        )
    }

    if (attemptQuery.isLoading) {
        return (
            <div className="p-8 text-sm text-muted-foreground">
                Loading attempt…
            </div>
        )
    }

    if (attemptQuery.isError || !attemptQuery.data) {
        return (
            <div className="p-8 space-y-2">
                <p className="text-sm text-destructive">Unable to load attempt details.</p>
                <Button asChild variant="link" className="px-0">
                    <Link to="/dashboard">Back to dashboard</Link>
                </Button>
            </div>
        )
    }

    const attempt = attemptQuery.data
    const updatedLabel = relativeTimeFromNow(attempt.updatedAt ?? attempt.createdAt ?? null)

    return (
        <div className="flex h-full flex-col overflow-auto bg-background px-8 py-6">
            <div className="mx-auto w-full max-w-5xl space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">
                            Attempt {attempt.id.slice(0, 8)}
                        </h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Status{' '}
                            <StatusBadge status={attempt.status} className="align-middle"/>
                            <span className="ml-2">
                                · Updated {updatedLabel}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Button asChild size="sm" variant="outline">
                            <Link to="/dashboard">Back to dashboard</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                            <Link to={`/projects/${attempt.boardId}`}>Open board</Link>
                        </Button>
                    </div>
                </div>

                <Card className="border-border/70 bg-card/60">
                    <CardHeader>
                        <CardTitle className="text-sm">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                        <div>
                            <span className="font-medium text-foreground">Agent: </span>
                            <span>{attempt.agent}</span>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Board: </span>
                            <span>{attempt.boardId}</span>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Card: </span>
                            <span>{attempt.cardId}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/60">
                    <CardHeader>
                        <CardTitle className="text-sm">Logs</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[420px] space-y-1 overflow-auto text-xs font-mono">
                        {logsQuery.isLoading ? (
                            <div className="text-muted-foreground">Loading logs…</div>
                        ) : logsQuery.isError || !logsQuery.data || logsQuery.data.length === 0 ? (
                            <div className="text-muted-foreground">
                                No logs available for this attempt yet.
                            </div>
                        ) : (
                            logsQuery.data.map((log) => (
                                <div key={`${log.id}-${log.ts}`} className="whitespace-pre-wrap">
                                    <span className="text-muted-foreground">
                                        [{relativeTimeFromNow(log.ts)}]
                                    </span>{' '}
                                    {log.message}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
