import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'

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
    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Automation scripts</h3>
            <div
                className="flex items-center gap-3 rounded-md border border-dashed border-border/60 bg-background/80 p-3">
                <Checkbox
                    id="allow-scripts-to-fail"
                    checked={allowScriptsToFail}
                    onCheckedChange={(checked) =>
                        update({allowScriptsToFail: checked === true})
                    }
                />
                <div className="space-y-1">
                    <Label htmlFor="allow-scripts-to-fail">Allow scripts to fail</Label>
                    <p className="text-xs text-muted-foreground">
                        When enabled, setup and copy-file automation failures are treated as warnings and won’t block agent startup.
                    </p>
                </div>
            </div>

            <div className="grid gap-2 rounded-md border border-dashed border-border/60 bg-background/80 p-3 md:grid-cols-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="allow-copy-files-to-fail"
                        checked={allowCopyFilesToFail}
                        onCheckedChange={(checked) =>
                            update({allowCopyFilesToFail: checked === true})
                        }
                    />
                    <Label htmlFor="allow-copy-files-to-fail" className="text-xs">
                        Allow Copy files to fail
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="allow-setup-script-to-fail"
                        checked={allowSetupScriptToFail}
                        onCheckedChange={(checked) =>
                            update({allowSetupScriptToFail: checked === true})
                        }
                    />
                    <Label htmlFor="allow-setup-script-to-fail" className="text-xs">
                        Allow Setup script to fail
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="allow-dev-script-to-fail"
                        checked={allowDevScriptToFail}
                        onCheckedChange={(checked) =>
                            update({allowDevScriptToFail: checked === true})
                        }
                    />
                    <Label htmlFor="allow-dev-script-to-fail" className="text-xs">
                        Allow Dev script to fail
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="allow-cleanup-script-to-fail"
                        checked={allowCleanupScriptToFail}
                        onCheckedChange={(checked) =>
                            update({allowCleanupScriptToFail: checked === true})
                        }
                    />
                    <Label htmlFor="allow-cleanup-script-to-fail" className="text-xs">
                        Allow Cleanup script to fail
                    </Label>
                </div>
                <p className="md:col-span-2 text-xs text-muted-foreground">
                    Per-script toggles apply even when the global setting is off.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="setup-script">Setup script</Label>
                    <Textarea id="setup-script" placeholder={`bun install\nnpm run prepare`} className="h-28"
                              value={setupScript} onChange={(e) => update({setupScript: e.target.value})}/>
                    <p className="text-xs text-muted-foreground">Run once to prepare the workspace (install deps,
                        generate code, etc.). Use newline for multiple commands.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dev-script">Dev script</Label>
                    <Textarea id="dev-script" placeholder="bun run dev" className="h-28" value={devScript}
                              onChange={(e) => update({devScript: e.target.value})}/>
                    <p className="text-xs text-muted-foreground">Optional command the agent can start to run your app
                        locally while working.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cleanup-script">Cleanup script</Label>
                    <Textarea id="cleanup-script" placeholder="bun run clean" className="h-28" value={cleanupScript}
                              onChange={(e) => update({cleanupScript: e.target.value})}/>
                    <p className="text-xs text-muted-foreground">Optional post-run cleanup (stop services, remove temp
                        files, etc.).</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="copy-files">Copy files</Label>
                    <Textarea id="copy-files" placeholder={`.env.example -> .env\napps/web/.env.local -> .env.local`}
                              className="h-28" value={copyFiles} onChange={(e) => update({copyFiles: e.target.value})}/>
                    <p className="text-xs text-muted-foreground">One mapping per line using <code className="font-mono">src
                        -&gt; dest</code>. Useful for seeding environment files.</p>
                </div>
            </div>
        </section>
    )
}
