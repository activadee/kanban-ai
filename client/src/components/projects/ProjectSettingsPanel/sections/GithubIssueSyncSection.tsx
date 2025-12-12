import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {useGithubAuthStatus} from '@/hooks/github'
import {useProjectGithubOrigin} from '@/hooks/projects'
import {useGithubIssueStats} from '@/hooks/board'

type GithubIssueSyncSectionProps = {
    projectId: string;
    boardId: string;
    githubIssueSyncEnabled: boolean;
    githubIssueSyncState: 'open' | 'all' | 'closed';
    githubIssueSyncIntervalMinutes: number;
    githubIssueAutoCreateEnabled: boolean;
    autoCloseTicketOnPRMerge: boolean;
    onChange: (patch: Partial<{
        githubIssueSyncEnabled: boolean;
        githubIssueSyncState: 'open' | 'all' | 'closed';
        githubIssueSyncIntervalMinutes: number;
        githubIssueAutoCreateEnabled: boolean;
        autoCloseTicketOnPRMerge: boolean;
    }>) => void;
}

export function GithubIssueSyncSection({
                                           projectId,
                                           boardId,
                                           githubIssueSyncEnabled,
                                           githubIssueSyncState,
                                           githubIssueSyncIntervalMinutes,
                                           githubIssueAutoCreateEnabled,
                                           autoCloseTicketOnPRMerge,
                                           onChange,
                                       }: GithubIssueSyncSectionProps) {
    const githubCheckQuery = useGithubAuthStatus()
    const originQuery = useProjectGithubOrigin(projectId)
    const statsQuery = useGithubIssueStats(boardId, {
        enabled: githubCheckQuery.data?.status === 'valid' && Boolean(originQuery.data?.owner && originQuery.data?.repo),
        staleTime: 30_000,
    })

    const hasGithubConnection = githubCheckQuery.data?.status === 'valid'
    const origin = originQuery.data
    const hasOrigin = Boolean(origin?.owner && origin?.repo)
    const disabled = !hasGithubConnection || !hasOrigin

    const handleIntervalChange = (value: string) => {
        const parsed = Number.parseInt(value, 10)
        if (Number.isNaN(parsed)) {
            onChange({githubIssueSyncIntervalMinutes: 15})
            return
        }
        const clamped = Math.min(1440, Math.max(5, parsed))
        onChange({githubIssueSyncIntervalMinutes: clamped})
    }

    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">GitHub Issue Sync</h3>
                {origin?.owner && origin?.repo ? (
                    <span className="text-xs text-muted-foreground">
                        {origin.owner}/{origin.repo}
                    </span>
                ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
                Automatically sync GitHub issues into this board&apos;s backlog and keep titles and descriptions up to date.
            </p>
            {disabled ? (
                <p className="text-xs text-muted-foreground">
                    Connect GitHub and configure the repo to enable automatic issue sync.
                </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="github-issue-sync-enabled"
                        checked={githubIssueSyncEnabled}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                            onChange({githubIssueSyncEnabled: checked === true})
                        }
                    />
                    <div className="space-y-1">
                        <Label htmlFor="github-issue-sync-enabled">Enable GitHub Issue Sync</Label>
                        <p className="text-xs text-muted-foreground">
                            When enabled, issues are synced in the background on a recurring interval.
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="github-issue-auto-create-enabled"
                        checked={githubIssueAutoCreateEnabled}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                            onChange({githubIssueAutoCreateEnabled: checked === true})
                        }
                    />
                    <div className="space-y-1">
                        <Label htmlFor="github-issue-auto-create-enabled">Enable GitHub Issue Creation</Label>
                        <p className="text-xs text-muted-foreground">
                            Allows creating GitHub issues when you create new tickets.
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="github-pr-auto-close-enabled"
                        checked={autoCloseTicketOnPRMerge}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                            onChange({autoCloseTicketOnPRMerge: checked === true})
                        }
                    />
                    <div className="space-y-1">
                        <Label htmlFor="github-pr-auto-close-enabled">
                            Auto-close tickets on PR merge
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Moves Review cards to Done when their linked PRs are merged.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Requires columns titled Review and Done.
                        </p>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="github-issue-sync-state">Sync issue state</Label>
                    <Select
                        value={githubIssueSyncState}
                        onValueChange={(value) =>
                            onChange({githubIssueSyncState: value as 'open' | 'all' | 'closed'})
                        }
                        disabled={disabled || !githubIssueSyncEnabled}
                    >
                        <SelectTrigger id="github-issue-sync-state" className="w-full">
                            <SelectValue placeholder="Open"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="github-issue-sync-interval">Sync interval (minutes)</Label>
                    <Input
                        id="github-issue-sync-interval"
                        type="number"
                        min={5}
                        max={1440}
                        value={githubIssueSyncIntervalMinutes.toString()}
                        disabled={
                            disabled ||
                            (!githubIssueSyncEnabled &&
                                !autoCloseTicketOnPRMerge)
                        }
                        onChange={(e) => handleIntervalChange(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        Runs at least every 5 minutes. Maximum once per day.
                    </p>
                </div>
            </div>
            {statsQuery.data ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Imported: {statsQuery.data.imported}</span>
                    <span>Exported: {statsQuery.data.exported}</span>
                    <span>Total linked: {statsQuery.data.total}</span>
                </div>
            ) : statsQuery.isLoading ? (
                <div className="text-xs text-muted-foreground">Loading GitHub issue stats…</div>
            ) : statsQuery.isError ? (
                <div className="text-xs text-muted-foreground">Unable to load GitHub issue stats.</div>
            ) : null}
        </section>
    )
}
