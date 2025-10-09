import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'

export function ScriptsForm({
                                setupScript,
                                devScript,
                                cleanupScript,
                                copyFiles,
                                update,
                            }: {
    setupScript: string
    devScript: string
    cleanupScript: string
    copyFiles: string
    update: (patch: Partial<{
        setupScript: string;
        devScript: string;
        cleanupScript: string;
        copyFiles: string
    }>) => void
}) {
    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Automation scripts</h3>
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

