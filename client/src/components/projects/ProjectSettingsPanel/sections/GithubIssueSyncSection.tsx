import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {useGithubAuthStatus} from '@/hooks/github'
import {useProjectGithubOrigin} from '@/hooks/projects'

type GithubIssueSyncSectionProps = {
    projectId: string;
    githubIssueSyncEnabled: boolean;
    githubIssueSyncState: 'open' | 'all' | 'closed';
    githubIssueSyncIntervalMinutes: number;
    onChange: (patch: Partial<{
        githubIssueSyncEnabled: boolean;
        githubIssueSyncState: 'open' | 'all' | 'closed';
        githubIssueSyncIntervalMinutes: number;
    }>) => void;
}

export function GithubIssueSyncSection({
                                           projectId,
                                           githubIssueSyncEnabled,
                                           githubIssueSyncState,
                                           githubIssueSyncIntervalMinutes,
                                           onChange,
                                       }: GithubIssueSyncSectionProps) {
    const githubCheckQuery = useGithubAuthStatus()
    const originQuery = useProjectGithubOrigin(projectId)

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
                        disabled={disabled || !githubIssueSyncEnabled}
                        onChange={(e) => handleIntervalChange(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        Runs at least every 5 minutes. Maximum once per day.
                    </p>
                </div>
            </div>
        </section>
    )
}

