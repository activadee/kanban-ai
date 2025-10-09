import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Checkbox} from '@/components/ui/checkbox'
import {Badge} from '@/components/ui/badge'

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
                                           branches,
                                           update,
                                       }: {
    baseBranch: string
    preferredRemote: string
    autoCommitOnFinish: boolean
    branches: Branch[]
    update: (patch: Partial<{ baseBranch: string; preferredRemote: string; autoCommitOnFinish: boolean }>) => void
}) {
    const NONE_VALUE = '__none__'
    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Repository defaults</h3>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="base-branch">Base branch</Label>
                    <Select value={baseBranch || undefined} onValueChange={(value) => update({baseBranch: value})}>
                        <SelectTrigger id="base-branch" className="w-full">
                            <SelectValue placeholder="Select base branch"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            {branches.filter((b) => b.kind === 'local').map((branch) => (
                                <SelectItem key={`local-${branch.name}`} value={branch.name}>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span>{branch.displayName}</span>
                                        {branch.isCurrent ? <Badge variant="secondary">current</Badge> : null}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="preferred-remote">Preferred remote</Label>
                    <Select
                        value={preferredRemote ? preferredRemote : NONE_VALUE}
                        onValueChange={(value) => update({preferredRemote: value === NONE_VALUE ? '' : value})}
                    >
                        <SelectTrigger id="preferred-remote" className="w-full">
                            <SelectValue placeholder="No preference"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value={NONE_VALUE}>
                                <div className="flex w-full items-center justify-between gap-2"><span>None</span></div>
                            </SelectItem>
                            {Array.from(new Set(branches.filter((b) => b.kind === 'remote' && b.remote).map((b) => b.remote!))).map((remote) => (
                                <SelectItem key={remote} value={remote}>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span>{remote}</span>
                                        <Badge variant="outline">remote</Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div
                className="flex items-center gap-3 rounded-md border border-dashed border-border/60 bg-background/80 p-3">
                <Checkbox id="auto-commit-on-finish" checked={autoCommitOnFinish}
                          onCheckedChange={(checked) => update({autoCommitOnFinish: checked === true})}/>
                <div className="space-y-1">
                    <Label htmlFor="auto-commit-on-finish">Auto-commit on finish</Label>
                    <p className="text-xs text-muted-foreground">When the agent succeeds, commit all changes using the
                        last assistant message as the commit message. Does not push.</p>
                </div>
            </div>
        </section>
    )
}

