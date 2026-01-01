import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Checkbox} from '@/components/ui/checkbox'
import {Badge} from '@/components/ui/badge'
import {GitBranch, GitCommit, Upload, ArrowRight, Check} from 'lucide-react'

type Branch = {
    name: string;
    displayName: string;
    isCurrent?: boolean;
    kind: 'local' | 'remote';
    remote?: string | null
}

export function RepositoryDefaultsForm({
    baseBranch,
    preferredRemote,
    autoCommitOnFinish,
    autoPushOnAutocommit,
    branches,
    update,
}: {
    baseBranch: string
    preferredRemote: string
    autoCommitOnFinish: boolean
    autoPushOnAutocommit: boolean
    branches: Branch[]
    update: (patch: Partial<{ baseBranch: string; preferredRemote: string; autoCommitOnFinish: boolean; autoPushOnAutocommit: boolean }>) => void
}) {
    const NONE_VALUE = '__none__'
    const localBranches = branches.filter((b) => b.kind === 'local')
    const remotes = Array.from(new Set(branches.filter((b) => b.kind === 'remote' && b.remote).map((b) => b.remote!)))

    return (
        <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="base-branch" className="text-sm font-medium">Base Branch</Label>
                    </div>
                    <Select value={baseBranch || undefined} onValueChange={(value) => update({baseBranch: value})}>
                        <SelectTrigger id="base-branch" className="h-10 transition-all focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="Select base branch" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {localBranches.map((branch) => (
                                <SelectItem key={`local-${branch.name}`} value={branch.name}>
                                    <div className="flex w-full items-center gap-2">
                                        <span className="font-mono text-sm">{branch.displayName}</span>
                                        {branch.isCurrent && (
                                            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                                                HEAD
                                            </Badge>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        New feature branches will be created from this branch.
                    </p>
                </div>

                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="preferred-remote" className="text-sm font-medium">Preferred Remote</Label>
                    </div>
                    <Select
                        value={preferredRemote ? preferredRemote : NONE_VALUE}
                        onValueChange={(value) => update({preferredRemote: value === NONE_VALUE ? '' : value})}
                    >
                        <SelectTrigger id="preferred-remote" className="h-10 transition-all focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="No preference" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            <SelectItem value={NONE_VALUE}>
                                <span className="text-muted-foreground">None (use tracking remote)</span>
                            </SelectItem>
                            {remotes.map((remote) => (
                                <SelectItem key={remote} value={remote}>
                                    <div className="flex w-full items-center gap-2">
                                        <span className="font-mono text-sm">{remote}</span>
                                        <Badge variant="outline" className="ml-auto h-5 border-dashed px-1.5 text-[10px]">
                                            remote
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Target remote for push operations.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <GitCommit className="h-3.5 w-3.5" />
                    <span>Automation Pipeline</span>
                </div>

                <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-r from-muted/20 via-background to-muted/20">
                    <div className="flex items-stretch divide-x divide-border/40">
                        <button
                            type="button"
                            onClick={() => update({
                                autoCommitOnFinish: !autoCommitOnFinish,
                                autoPushOnAutocommit: !autoCommitOnFinish ? autoPushOnAutocommit : false,
                            })}
                            className="group relative flex flex-1 flex-col items-center gap-3 p-5 transition-colors hover:bg-muted/30"
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                autoCommitOnFinish
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/60 bg-muted/30 text-muted-foreground'
                            }`}>
                                {autoCommitOnFinish ? <Check className="h-5 w-5" /> : <GitCommit className="h-5 w-5" />}
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-medium">Auto-commit</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">on agent finish</div>
                            </div>
                            <Badge
                                variant={autoCommitOnFinish ? 'default' : 'outline'}
                                className={`absolute right-2 top-2 h-5 text-[10px] ${
                                    autoCommitOnFinish ? 'bg-emerald-500/90' : 'border-dashed'
                                }`}
                            >
                                {autoCommitOnFinish ? 'ON' : 'OFF'}
                            </Badge>
                        </button>

                        <div className="flex items-center px-2">
                            <ArrowRight className={`h-4 w-4 transition-colors ${
                                autoCommitOnFinish ? 'text-muted-foreground' : 'text-muted-foreground/30'
                            }`} />
                        </div>

                        <button
                            type="button"
                            onClick={() => autoCommitOnFinish && update({autoPushOnAutocommit: !autoPushOnAutocommit})}
                            disabled={!autoCommitOnFinish}
                            className={`group relative flex flex-1 flex-col items-center gap-3 p-5 transition-colors ${
                                autoCommitOnFinish ? 'hover:bg-muted/30' : 'cursor-not-allowed opacity-40'
                            }`}
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                autoPushOnAutocommit && autoCommitOnFinish
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/60 bg-muted/30 text-muted-foreground'
                            }`}>
                                {autoPushOnAutocommit && autoCommitOnFinish ? <Check className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-medium">Auto-push</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">to remote</div>
                            </div>
                            <Badge
                                variant={autoPushOnAutocommit && autoCommitOnFinish ? 'default' : 'outline'}
                                className={`absolute right-2 top-2 h-5 text-[10px] ${
                                    autoPushOnAutocommit && autoCommitOnFinish ? 'bg-emerald-500/90' : 'border-dashed'
                                }`}
                            >
                                {autoPushOnAutocommit && autoCommitOnFinish ? 'ON' : 'OFF'}
                            </Badge>
                        </button>
                    </div>

                    <div className="border-t border-border/40 bg-muted/20 px-4 py-2.5">
                        <p className="text-center text-xs text-muted-foreground">
                            {autoCommitOnFinish && autoPushOnAutocommit
                                ? 'Changes will be committed and pushed automatically when the agent succeeds.'
                                : autoCommitOnFinish
                                    ? 'Changes will be committed automatically. Push manually when ready.'
                                    : 'Manual commit and push required after agent completion.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="auto-commit-detail"
                        checked={autoCommitOnFinish}
                        onCheckedChange={(checked) => update({
                            autoCommitOnFinish: checked === true,
                            autoPushOnAutocommit: checked === true ? autoPushOnAutocommit : false,
                        })}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="auto-commit-detail" className="text-sm font-medium leading-none">
                            Auto-commit on finish
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Commits all changes using the assistant&apos;s last message when the agent succeeds.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 pl-7">
                    <Checkbox
                        id="auto-push-detail"
                        checked={autoPushOnAutocommit}
                        disabled={!autoCommitOnFinish}
                        onCheckedChange={(checked) => update({autoPushOnAutocommit: checked === true})}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label
                            htmlFor="auto-push-detail"
                            className={`text-sm font-medium leading-none ${!autoCommitOnFinish ? 'text-muted-foreground' : ''}`}
                        >
                            Auto-push after auto-commit
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Pushes to the preferred remote (or tracking remote) after committing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
