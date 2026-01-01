import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Checkbox} from '@/components/ui/checkbox'
import {Badge} from '@/components/ui/badge'
import {Settings, Palette, Globe, Bell, Volume2, Monitor, PlayCircle, Check} from 'lucide-react'
import {cn} from '@/lib/utils'

export type GeneralForm = {
    theme: 'system' | 'light' | 'dark'
    language: 'browser' | 'en' | 'ja'
    telemetryEnabled: boolean
    notificationsAgentCompletionSound: boolean
    notificationsDesktop: boolean
    autoStartAgentOnInProgress: boolean
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

type ToggleCardProps = {
    icon: React.ComponentType<{className?: string}>
    title: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
}

function ToggleCard({icon: Icon, title, description, checked, disabled, onChange}: ToggleCardProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'group relative overflow-hidden rounded-lg border p-4 text-left transition-all',
                disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:border-border/60 hover:bg-card/50',
                checked && !disabled
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border/40 bg-card/30'
            )}
        >
            <div className="flex items-start justify-between">
                <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                    checked && !disabled
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                        : 'border-border/40 bg-muted/30 text-muted-foreground'
                )}>
                    <Icon className="h-5 w-5" />
                </div>
                <Badge
                    variant={checked && !disabled ? 'default' : 'outline'}
                    className={cn(
                        'h-5 text-[10px]',
                        checked && !disabled ? 'bg-emerald-500/90' : 'border-dashed'
                    )}
                >
                    {checked ? 'ON' : 'OFF'}
                </Badge>
            </div>
            <div className="mt-3">
                <div className="font-medium">{title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
        </button>
    )
}

export function GeneralSettingsSection({form, onChange, onDesktopToggle}: {
    form: GeneralForm;
    onChange: (patch: Partial<GeneralForm>) => void;
    onDesktopToggle: (checked: boolean) => void
}) {
    return (
        <div className="space-y-6">
            <SectionHeader
                icon={Settings}
                title="General Settings"
                description="Theme, language, and application preferences"
            />

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Palette className="h-3.5 w-3.5" />
                        <span>Appearance</span>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                                <Label htmlFor="theme" className="text-sm font-medium">Theme</Label>
                            </div>
                            <Select value={form.theme} onValueChange={(v) => onChange({theme: v as GeneralForm['theme']})}>
                                <SelectTrigger id="theme" className="h-10 transition-all focus:ring-2 focus:ring-primary/20">
                                    <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                                            System default
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="light">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-amber-400" />
                                            Light
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="dark">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-slate-700" />
                                            Dark
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Controls the application color scheme.
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                <Label htmlFor="language" className="text-sm font-medium">Language</Label>
                            </div>
                            <Select value={form.language} onValueChange={(v) => onChange({language: v as GeneralForm['language']})}>
                                <SelectTrigger id="language" className="h-10 transition-all focus:ring-2 focus:ring-primary/20">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="browser">Browser default</SelectItem>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="ja">日本語</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Set your preferred interface language.
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Bell className="h-3.5 w-3.5" />
                        <span>Notifications</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleCard
                            icon={Volume2}
                            title="Completion Sound"
                            description="Play audio when agent finishes"
                            checked={form.notificationsAgentCompletionSound}
                            onChange={(v) => onChange({notificationsAgentCompletionSound: v})}
                        />
                        <ToggleCard
                            icon={Monitor}
                            title="Desktop Alerts"
                            description="Browser notification popups"
                            checked={form.notificationsDesktop}
                            onChange={onDesktopToggle}
                        />
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>Automation</span>
                    </div>

                    <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-r from-muted/20 via-background to-muted/20">
                        <button
                            type="button"
                            onClick={() => onChange({autoStartAgentOnInProgress: !form.autoStartAgentOnInProgress})}
                            className="group relative flex w-full items-center gap-4 p-5 transition-colors hover:bg-muted/30"
                        >
                            <div className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all',
                                form.autoStartAgentOnInProgress
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border/60 bg-muted/30 text-muted-foreground'
                            )}>
                                {form.autoStartAgentOnInProgress ? (
                                    <Check className="h-6 w-6" />
                                ) : (
                                    <PlayCircle className="h-6 w-6" />
                                )}
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-medium">Auto-start agent on In Progress</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    Automatically runs the project&apos;s default agent when a ticket moves to In Progress
                                </div>
                            </div>
                            <Badge
                                variant={form.autoStartAgentOnInProgress ? 'default' : 'outline'}
                                className={cn(
                                    'h-6 px-2.5 text-[10px]',
                                    form.autoStartAgentOnInProgress ? 'bg-emerald-500/90' : 'border-dashed'
                                )}
                            >
                                {form.autoStartAgentOnInProgress ? 'ENABLED' : 'DISABLED'}
                            </Badge>
                        </button>
                    </div>
                </div>
            </SettingsCard>

            <div className="space-y-3 rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="telemetry"
                        checked={form.telemetryEnabled}
                        onCheckedChange={(v) => onChange({telemetryEnabled: v === true})}
                        className="mt-0.5"
                    />
                    <div className="space-y-1">
                        <Label htmlFor="telemetry" className="text-sm font-medium leading-none">
                            Usage telemetry
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Send anonymous usage statistics to help improve KanbanAI. No personal data is collected.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
