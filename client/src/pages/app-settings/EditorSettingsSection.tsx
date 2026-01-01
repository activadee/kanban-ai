import {useState} from 'react'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {FileBrowserDialog} from '@/components/fs/FileBrowserDialog'
import {Terminal, FolderOpen, X, CheckCircle, AlertCircle, Loader2, Code2} from 'lucide-react'
import {cn} from '@/lib/utils'

interface EditorSettingsSectionProps {
    editorCommand: string | null
    validationStatus?: 'valid' | 'invalid' | 'pending' | null
    onChange: (value: string | null) => void
}

function SectionHeader({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{className?: string}>
    title: string
    description: string
}) {
    return (
        <div className="mb-6 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-gradient-to-br from-muted/50 to-muted/20 shadow-sm">
                <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    )
}

function SettingsCard({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('rounded-xl border border-border/40 bg-card/30 p-5 shadow-sm', className)}>
            {children}
        </div>
    )
}

export function EditorSettingsSection({
    editorCommand,
    validationStatus,
    onChange,
}: EditorSettingsSectionProps) {
    const [browserOpen, setBrowserOpen] = useState(false)

    const getStatusIcon = () => {
        switch (validationStatus) {
            case 'valid':
                return <CheckCircle className="h-4 w-4 text-emerald-500" />
            case 'invalid':
                return <AlertCircle className="h-4 w-4 text-destructive" />
            case 'pending':
                return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            default:
                return null
        }
    }

    const getStatusBadge = () => {
        switch (validationStatus) {
            case 'valid':
                return (
                    <Badge variant="secondary" className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" />
                        Valid
                    </Badge>
                )
            case 'invalid':
                return (
                    <Badge variant="outline" className="gap-1.5 border-destructive/60 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        Invalid
                    </Badge>
                )
            case 'pending':
                return (
                    <Badge variant="outline" className="gap-1.5 border-muted-foreground/40 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Validating
                    </Badge>
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                icon={Terminal}
                title="Editor Configuration"
                description="Configure the external editor for opening project files"
            />

            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                <div className="relative p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm',
                                editorCommand && validationStatus === 'valid'
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                    : editorCommand && validationStatus === 'invalid'
                                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                        : 'border-border/40 bg-muted/30 text-muted-foreground'
                            )}>
                                <Code2 className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-semibold">
                                        {editorCommand ? 'Editor Configured' : 'No Editor Set'}
                                    </span>
                                    {getStatusBadge()}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {editorCommand
                                        ? 'Use "Open in Editor" to launch files directly from the app.'
                                        : 'Configure an editor to enable "Open in Editor" feature.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Terminal className="h-3.5 w-3.5" />
                        <span>Editor Executable</span>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="editor-command" className="text-sm font-medium">
                            Path to editor executable
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="editor-command"
                                    value={editorCommand || ''}
                                    onChange={(e) => onChange(e.target.value || null)}
                                    placeholder="/usr/bin/code"
                                    className={cn(
                                        'h-10 pr-10 font-mono text-sm transition-all focus:ring-2 focus:ring-primary/20',
                                        validationStatus === 'invalid' && 'border-destructive/50 focus:ring-destructive/20'
                                    )}
                                />
                                {getStatusIcon() && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {getStatusIcon()}
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => setBrowserOpen(true)}
                                title="Browse for executable"
                            >
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                            {editorCommand && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={() => onChange(null)}
                                    title="Clear"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {validationStatus === 'valid' && (
                            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle className="h-3 w-3" />
                                Executable found and valid
                            </p>
                        )}
                        {validationStatus === 'invalid' && (
                            <p className="flex items-center gap-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                File not found or not executable
                            </p>
                        )}
                        {validationStatus === 'pending' && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Checking executable...
                            </p>
                        )}
                        {!editorCommand && (
                            <p className="text-xs text-muted-foreground">
                                No editor configured. The &quot;Open in Editor&quot; feature will be disabled.
                            </p>
                        )}
                    </div>
                </div>
            </SettingsCard>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="space-y-3">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Common Editor Paths
                    </div>
                    <div className="grid gap-2 text-xs">
                        <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                            <span className="font-mono text-muted-foreground">VS Code</span>
                            <code className="font-mono text-[11px] text-foreground/70">/usr/bin/code</code>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                            <span className="font-mono text-muted-foreground">Cursor</span>
                            <code className="font-mono text-[11px] text-foreground/70">/usr/bin/cursor</code>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                            <span className="font-mono text-muted-foreground">Sublime Text</span>
                            <code className="font-mono text-[11px] text-foreground/70">/usr/bin/subl</code>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                            <span className="font-mono text-muted-foreground">Vim</span>
                            <code className="font-mono text-[11px] text-foreground/70">/usr/bin/vim</code>
                        </div>
                    </div>
                </div>
            </div>

            <FileBrowserDialog
                open={browserOpen}
                onOpenChange={setBrowserOpen}
                onSelect={(path) => {
                    onChange(path)
                    setBrowserOpen(false)
                }}
                initialPath={editorCommand || undefined}
            />
        </div>
    )
}
