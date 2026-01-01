import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {Badge} from '@/components/ui/badge'
import {Copy, Wrench, Play, Trash2, AlertTriangle, ArrowRight} from 'lucide-react'

type ScriptConfig = {
    id: 'copyFiles' | 'setup' | 'dev' | 'cleanup'
    label: string
    icon: React.ReactNode
    description: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    allowFail: boolean
    onAllowFailChange: (value: boolean) => void
    step: number
}

export function ScriptsForm({
    setupScript,
    devScript,
    cleanupScript,
    copyFiles,
    allowScriptsToFail,
    allowCopyFilesToFail,
    allowSetupScriptToFail,
    allowDevScriptToFail,
    allowCleanupScriptToFail,
    update,
}: {
    setupScript: string
    devScript: string
    cleanupScript: string
    copyFiles: string
    allowScriptsToFail: boolean
    allowCopyFilesToFail: boolean
    allowSetupScriptToFail: boolean
    allowDevScriptToFail: boolean
    allowCleanupScriptToFail: boolean
    update: (patch: Partial<{
        setupScript: string;
        devScript: string;
        cleanupScript: string;
        copyFiles: string;
        allowScriptsToFail: boolean;
        allowCopyFilesToFail: boolean;
        allowSetupScriptToFail: boolean;
        allowDevScriptToFail: boolean;
        allowCleanupScriptToFail: boolean;
    }>) => void
}) {
    const scripts: ScriptConfig[] = [
        {
            id: 'copyFiles',
            label: 'Copy Files',
            icon: <Copy className="h-4 w-4" />,
            description: 'File mappings to copy into the worktree',
            placeholder: '.env.example -> .env\napps/web/.env.local -> .env.local',
            value: copyFiles,
            onChange: (v) => update({copyFiles: v}),
            allowFail: allowCopyFilesToFail,
            onAllowFailChange: (v) => update({allowCopyFilesToFail: v}),
            step: 1,
        },
        {
            id: 'setup',
            label: 'Setup Script',
            icon: <Wrench className="h-4 w-4" />,
            description: 'Runs once to prepare the workspace',
            placeholder: 'bun install\nnpm run prepare',
            value: setupScript,
            onChange: (v) => update({setupScript: v}),
            allowFail: allowSetupScriptToFail,
            onAllowFailChange: (v) => update({allowSetupScriptToFail: v}),
            step: 2,
        },
        {
            id: 'dev',
            label: 'Dev Script',
            icon: <Play className="h-4 w-4" />,
            description: 'Optional dev server command',
            placeholder: 'bun run dev',
            value: devScript,
            onChange: (v) => update({devScript: v}),
            allowFail: allowDevScriptToFail,
            onAllowFailChange: (v) => update({allowDevScriptToFail: v}),
            step: 3,
        },
        {
            id: 'cleanup',
            label: 'Cleanup Script',
            icon: <Trash2 className="h-4 w-4" />,
            description: 'Post-run cleanup commands',
            placeholder: 'bun run clean',
            value: cleanupScript,
            onChange: (v) => update({cleanupScript: v}),
            allowFail: allowCleanupScriptToFail,
            onAllowFailChange: (v) => update({allowCleanupScriptToFail: v}),
            step: 4,
        },
    ]

    const activeScripts = scripts.filter(s => s.value.trim())

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-r from-amber-500/5 via-background to-amber-500/5">
                <div className="flex items-center gap-4 p-4">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all ${
                            allowScriptsToFail
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                                : 'border-border/60 bg-muted/30 text-muted-foreground'
                        }`}>
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="allow-scripts-to-fail"
                                checked={allowScriptsToFail}
                                onCheckedChange={(checked) => update({allowScriptsToFail: checked === true})}
                            />
                            <div>
                                <Label htmlFor="allow-scripts-to-fail" className="text-sm font-medium">
                                    Allow scripts to fail globally
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Treat all script failures as warnings
                                </p>
                            </div>
                        </div>
                    </div>
                    <Badge
                        variant={allowScriptsToFail ? 'default' : 'outline'}
                        className={`ml-auto ${allowScriptsToFail ? 'bg-amber-500/90' : 'border-dashed'}`}
                    >
                        {allowScriptsToFail ? 'LENIENT' : 'STRICT'}
                    </Badge>
                </div>
            </div>

            {activeScripts.length > 0 && (
                <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                    <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Execution Order
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {activeScripts.map((script, idx) => (
                            <div key={script.id} className="flex items-center gap-2">
                                <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background px-3 py-1.5">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                        {script.step}
                                    </span>
                                    <span className="text-sm">{script.label}</span>
                                    {(script.allowFail || allowScriptsToFail) && (
                                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                                    )}
                                </div>
                                {idx < activeScripts.length - 1 && (
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                {scripts.map((script) => (
                    <div
                        key={script.id}
                        className="group relative overflow-hidden rounded-lg border border-border/40 bg-card/30 transition-all hover:border-border/60 hover:bg-card/50"
                    >
                        <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm">
                                    {script.icon}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-muted-foreground">{script.step}.</span>
                                        <span className="text-sm font-medium">{script.label}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{script.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {script.value.trim() ? (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                        {script.value.split('\n').filter(l => l.trim()).length} cmd{script.value.split('\n').filter(l => l.trim()).length !== 1 ? 's' : ''}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="h-5 border-dashed px-1.5 text-[10px]">
                                        empty
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="p-4">
                            <Textarea
                                placeholder={script.placeholder}
                                className="min-h-[100px] resize-none font-mono text-xs leading-relaxed transition-all focus:ring-2 focus:ring-primary/20"
                                value={script.value}
                                onChange={(e) => script.onChange(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between border-t border-border/30 bg-muted/10 px-4 py-2.5">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`allow-${script.id}-fail`}
                                    checked={script.allowFail}
                                    onCheckedChange={(checked) => script.onAllowFailChange(checked === true)}
                                    className="h-3.5 w-3.5"
                                />
                                <Label htmlFor={`allow-${script.id}-fail`} className="text-xs text-muted-foreground">
                                    Allow to fail
                                </Label>
                            </div>
                            {(script.allowFail || allowScriptsToFail) && (
                                <div className="flex items-center gap-1 text-xs text-amber-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>{allowScriptsToFail ? 'Global' : 'Local'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="font-medium text-foreground">Copy Files</strong> uses{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">src -&gt; dest</code>{' '}
                    format, one mapping per line. Scripts run line by line. Per-script failure settings
                    apply even when the global setting is off.
                </p>
            </div>
        </div>
    )
}
