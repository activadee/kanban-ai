import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'
import {useGithubAuthStatus} from '@/hooks/github'
import {useProjectGithubOrigin} from '@/hooks/projects'
import {useGithubIssueStats} from '@/hooks/board'
import {Github, Check, X, RefreshCw, ArrowDownToLine, ArrowUpFromLine, GitMerge, Clock, Link2} from 'lucide-react'

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
        <div className="space-y-5">
            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                <div className="relative p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm ${
                                hasGithubConnection && hasOrigin
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/40 bg-muted/30 text-muted-foreground'
                            }`}>
                                <Github className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-semibold">
                                        {hasOrigin ? `${origin?.owner}/${origin?.repo}` : 'Not connected'}
                                    </span>
                                    {hasGithubConnection && hasOrigin && (
                                        <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                                            <Check className="h-3 w-3" />
                                            Connected
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {hasGithubConnection
                                        ? hasOrigin
                                            ? 'Repository linked and ready for sync'
                                            : 'GitHub connected, but no repository configured'
                                        : 'Connect GitHub to enable issue sync'}
                                </p>
                            </div>
                        </div>

                        {statsQuery.data && (
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums">
                                        <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                                        {statsQuery.data.imported}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Imported</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums">
                                        <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" />
                                        {statsQuery.data.exported}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Exported</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums">
                                        <Link2 className="h-4 w-4 text-muted-foreground" />
                                        {statsQuery.data.total}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Linked</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {disabled && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-amber-500" />
                        <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                            {!hasGithubConnection
                                ? 'Connect your GitHub account in global settings to enable sync features.'
                                : 'Configure a repository origin to enable GitHub integration.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sync Features
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange({githubIssueSyncEnabled: !githubIssueSyncEnabled})}
                        className={`group relative overflow-hidden rounded-lg border p-4 text-left transition-all ${
                            disabled
                                ? 'cursor-not-allowed opacity-50'
                                : 'hover:border-border/60 hover:bg-card/50'
                        } ${
                            githubIssueSyncEnabled && !disabled
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-border/40 bg-card/30'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                                githubIssueSyncEnabled && !disabled
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/40 bg-muted/30 text-muted-foreground'
                            }`}>
                                <RefreshCw className="h-5 w-5" />
                            </div>
                            <Badge
                                variant={githubIssueSyncEnabled && !disabled ? 'default' : 'outline'}
                                className={`h-5 text-[10px] ${
                                    githubIssueSyncEnabled && !disabled ? 'bg-emerald-500/90' : 'border-dashed'
                                }`}
                            >
                                {githubIssueSyncEnabled ? 'ON' : 'OFF'}
                            </Badge>
                        </div>
                        <div className="mt-3">
                            <div className="font-medium">Issue Sync</div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Import issues on interval
                            </p>
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange({githubIssueAutoCreateEnabled: !githubIssueAutoCreateEnabled})}
                        className={`group relative overflow-hidden rounded-lg border p-4 text-left transition-all ${
                            disabled
                                ? 'cursor-not-allowed opacity-50'
                                : 'hover:border-border/60 hover:bg-card/50'
                        } ${
                            githubIssueAutoCreateEnabled && !disabled
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-border/40 bg-card/30'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                                githubIssueAutoCreateEnabled && !disabled
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/40 bg-muted/30 text-muted-foreground'
                            }`}>
                                <ArrowUpFromLine className="h-5 w-5" />
                            </div>
                            <Badge
                                variant={githubIssueAutoCreateEnabled && !disabled ? 'default' : 'outline'}
                                className={`h-5 text-[10px] ${
                                    githubIssueAutoCreateEnabled && !disabled ? 'bg-emerald-500/90' : 'border-dashed'
                                }`}
                            >
                                {githubIssueAutoCreateEnabled ? 'ON' : 'OFF'}
                            </Badge>
                        </div>
                        <div className="mt-3">
                            <div className="font-medium">Issue Creation</div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Export tickets as issues
                            </p>
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange({autoCloseTicketOnPRMerge: !autoCloseTicketOnPRMerge})}
                        className={`group relative overflow-hidden rounded-lg border p-4 text-left transition-all ${
                            disabled
                                ? 'cursor-not-allowed opacity-50'
                                : 'hover:border-border/60 hover:bg-card/50'
                        } ${
                            autoCloseTicketOnPRMerge && !disabled
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-border/40 bg-card/30'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                                autoCloseTicketOnPRMerge && !disabled
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/40 bg-muted/30 text-muted-foreground'
                            }`}>
                                <GitMerge className="h-5 w-5" />
                            </div>
                            <Badge
                                variant={autoCloseTicketOnPRMerge && !disabled ? 'default' : 'outline'}
                                className={`h-5 text-[10px] ${
                                    autoCloseTicketOnPRMerge && !disabled ? 'bg-emerald-500/90' : 'border-dashed'
                                }`}
                            >
                                {autoCloseTicketOnPRMerge ? 'ON' : 'OFF'}
                            </Badge>
                        </div>
                        <div className="mt-3">
                            <div className="font-medium">Auto-close on Merge</div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Move to Done on PR merge
                            </p>
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sync Configuration
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2.5">
                        <Label htmlFor="github-issue-sync-state" className="text-sm font-medium">
                            Issue State Filter
                        </Label>
                        <Select
                            value={githubIssueSyncState}
                            onValueChange={(value) => onChange({githubIssueSyncState: value as 'open' | 'all' | 'closed'})}
                            disabled={disabled || !githubIssueSyncEnabled}
                        >
                            <SelectTrigger
                                id="github-issue-sync-state"
                                className={`h-10 transition-all focus:ring-2 focus:ring-primary/20 ${
                                    !githubIssueSyncEnabled ? 'opacity-50' : ''
                                }`}
                            >
                                <SelectValue placeholder="Open" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                        Open issues only
                                    </div>
                                </SelectItem>
                                <SelectItem value="closed">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                                        Closed issues only
                                    </div>
                                </SelectItem>
                                <SelectItem value="all">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                                        All issues
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <Label htmlFor="github-issue-sync-interval" className="text-sm font-medium">
                                Sync Interval
                            </Label>
                        </div>
                        <div className="relative">
                            <Input
                                id="github-issue-sync-interval"
                                type="number"
                                min={5}
                                max={1440}
                                value={githubIssueSyncIntervalMinutes.toString()}
                                disabled={disabled || (!githubIssueSyncEnabled && !autoCloseTicketOnPRMerge)}
                                onChange={(e) => handleIntervalChange(e.target.value)}
                                className={`h-10 pr-16 font-mono tabular-nums transition-all focus:ring-2 focus:ring-primary/20 ${
                                    !githubIssueSyncEnabled && !autoCloseTicketOnPRMerge ? 'opacity-50' : ''
                                }`}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-muted-foreground">
                                minutes
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Range: 5 min to 24 hours (1440 min)
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="sync-enabled-detail"
                        checked={githubIssueSyncEnabled}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange({githubIssueSyncEnabled: checked === true})}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="sync-enabled-detail" className="text-sm font-medium leading-none">
                            Enable GitHub Issue Sync
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Periodically imports issues from GitHub into your board&apos;s backlog.
                            Keeps titles and descriptions synchronized.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Checkbox
                        id="create-enabled-detail"
                        checked={githubIssueAutoCreateEnabled}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange({githubIssueAutoCreateEnabled: checked === true})}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="create-enabled-detail" className="text-sm font-medium leading-none">
                            Enable GitHub Issue Creation
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Allows exporting tickets as GitHub issues when creating new cards.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Checkbox
                        id="auto-close-detail"
                        checked={autoCloseTicketOnPRMerge}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange({autoCloseTicketOnPRMerge: checked === true})}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="auto-close-detail" className="text-sm font-medium leading-none">
                            Auto-close tickets on PR merge
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Moves cards from Review to Done when their linked PRs are merged.
                            Requires columns titled &quot;Review&quot; and &quot;Done&quot;.
                        </p>
                    </div>
                </div>
            </div>

            {statsQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Loading GitHub stats...</div>
            )}
            {statsQuery.isError && (
                <div className="text-xs text-destructive">Failed to load GitHub stats</div>
            )}
        </div>
    )
}
