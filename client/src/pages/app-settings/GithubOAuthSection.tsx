import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Key, Shield, Clock, Check, AlertTriangle} from 'lucide-react'
import {cn} from '@/lib/utils'
import type {GithubAppConfig} from 'shared'

type GithubAppForm = {
    clientId: string
    clientSecret: string
    hasClientSecret: boolean
    secretAction: 'unchanged' | 'update' | 'clear'
    source: GithubAppConfig['source']
    updatedAt: string | null
}

type GithubOAuthSectionProps = {
    form: GithubAppForm | null
    onChange: (patch: Partial<GithubAppForm>) => void
    onClearSecret: (clear: boolean) => void
    dirty: boolean
    saving: boolean
    onReset: () => void
    onSave: () => void
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

export function GithubOAuthSection({
    form,
    onChange,
    onClearSecret,
    dirty,
    saving,
    onReset,
    onSave,
}: GithubOAuthSectionProps) {
    if (!form) {
        return (
            <div className="space-y-6">
                <SectionHeader
                    icon={Key}
                    title="GitHub OAuth"
                    description="Configure GitHub OAuth app credentials for device flow authentication"
                />
                <SettingsCard>
                    <div className="flex h-32 items-center justify-center">
                        <div className="text-sm text-muted-foreground">Loading OAuth configuration...</div>
                    </div>
                </SettingsCard>
            </div>
        )
    }

    const sourceLabel =
        form.source === 'db'
            ? 'Stored in database'
            : form.source === 'env'
                ? 'From environment'
                : 'Not configured'

    const sourceVariant = form.source === 'db' ? 'default' : form.source === 'env' ? 'secondary' : 'outline'

    return (
        <div className="space-y-6">
            <SectionHeader
                icon={Key}
                title="GitHub OAuth"
                description="Configure GitHub OAuth app credentials for device flow authentication"
            />

            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                <div className="relative p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm',
                                form.hasClientSecret
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                            )}>
                                <Shield className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-semibold">
                                        {form.hasClientSecret ? 'Configured' : 'Setup Required'}
                                    </span>
                                    <Badge variant={sourceVariant} className="h-5 gap-1 px-1.5 text-[10px]">
                                        {form.source === 'db' && <Check className="h-3 w-3" />}
                                        {sourceLabel}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {form.hasClientSecret
                                        ? 'OAuth credentials are configured and ready for GitHub device flow.'
                                        : 'Set your GitHub OAuth app credentials to enable GitHub login.'}
                                </p>
                            </div>
                        </div>

                        {form.updatedAt && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Updated {new Date(form.updatedAt).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Key className="h-3.5 w-3.5" />
                        <span>OAuth App Credentials</span>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2.5">
                            <Label htmlFor="gh-client-id" className="text-sm font-medium">
                                Client ID
                            </Label>
                            <Input
                                id="gh-client-id"
                                value={form.clientId}
                                disabled={saving}
                                placeholder="Iv1.xxxxxxxxxxxx"
                                onChange={(e) => onChange({clientId: e.target.value})}
                                className="h-10 font-mono text-sm transition-all focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Your OAuth app&apos;s Client ID from GitHub Developer Settings.
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            <Label htmlFor="gh-client-secret" className="text-sm font-medium">
                                Client Secret
                            </Label>
                            <Input
                                id="gh-client-secret"
                                type="password"
                                value={form.clientSecret}
                                disabled={saving}
                                placeholder={form.hasClientSecret ? '•••••••••• (kept)' : 'Enter client secret'}
                                onChange={(e) => onChange({clientSecret: e.target.value})}
                                className={cn(
                                    'h-10 font-mono text-sm transition-all focus:ring-2 focus:ring-primary/20',
                                    !form.clientSecret && form.hasClientSecret && 'placeholder:font-mono'
                                )}
                            />
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {form.hasClientSecret
                                    ? 'Leave blank to keep existing secret.'
                                    : 'Required for GitHub device flow authentication.'}
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <div className="space-y-3 rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="clear-secret"
                        checked={form.secretAction === 'clear'}
                        disabled={saving}
                        onCheckedChange={(checked) => onClearSecret(checked === true)}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="clear-secret" className="text-sm font-medium leading-none">
                            Remove stored secret
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Delete the client secret from the database and fall back to environment variables.
                        </p>
                    </div>
                </div>
            </div>

            {!form.hasClientSecret && !form.clientSecret && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                GitHub login unavailable
                            </p>
                            <p className="text-xs leading-relaxed text-amber-600/80 dark:text-amber-400/80">
                                Configure your OAuth app credentials to enable GitHub device flow authentication.
                                Create an OAuth app at GitHub Developer Settings with device flow enabled.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!dirty || saving}
                    onClick={onReset}
                >
                    Reset
                </Button>
                <Button
                    size="sm"
                    disabled={!dirty || saving || !form.clientId.trim()}
                    onClick={onSave}
                >
                    {saving ? 'Saving...' : 'Save GitHub OAuth'}
                </Button>
            </div>
        </div>
    )
}
