import {Badge} from '@/components/ui/badge'
import {FileText, Bot, User, Cog, Brain} from 'lucide-react'
import {cn} from '@/lib/utils'

export type StreamdownForm = {
    streamdownAssistantEnabled: boolean
    streamdownUserEnabled: boolean
    streamdownSystemEnabled: boolean
    streamdownThinkingEnabled: boolean
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
    onChange: (checked: boolean) => void
}

function ToggleCard({icon: Icon, title, description, checked, onChange}: ToggleCardProps) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={cn(
                'group relative overflow-hidden rounded-lg border p-4 text-left transition-all',
                'hover:border-border/60 hover:bg-card/50',
                checked
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border/40 bg-card/30'
            )}
        >
            <div className="flex items-start justify-between">
                <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                    checked
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                        : 'border-border/40 bg-muted/30 text-muted-foreground'
                )}>
                    <Icon className="h-5 w-5" />
                </div>
                <Badge
                    variant={checked ? 'default' : 'outline'}
                    className={cn(
                        'h-5 text-[10px]',
                        checked ? 'bg-emerald-500/90' : 'border-dashed'
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

export function StreamdownSettingsSection({form, onChange}: {
    form: StreamdownForm
    onChange: (patch: Partial<StreamdownForm>) => void
}) {
    return (
        <div className="space-y-6">
            <SectionHeader
                icon={FileText}
                title="Message Rendering"
                description="Control rich text rendering (Streamdown) for different message types"
            />

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Streamdown Rendering</span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        When enabled, messages are rendered with rich formatting including syntax highlighting, 
                        markdown, and code blocks. When disabled, messages display as plain text.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleCard
                            icon={Bot}
                            title="Assistant Messages"
                            description="AI responses with code and formatting"
                            checked={form.streamdownAssistantEnabled}
                            onChange={(v) => onChange({streamdownAssistantEnabled: v})}
                        />
                        <ToggleCard
                            icon={User}
                            title="User Messages"
                            description="Your messages and prompts"
                            checked={form.streamdownUserEnabled}
                            onChange={(v) => onChange({streamdownUserEnabled: v})}
                        />
                        <ToggleCard
                            icon={Cog}
                            title="System Messages"
                            description="System instructions and context"
                            checked={form.streamdownSystemEnabled}
                            onChange={(v) => onChange({streamdownSystemEnabled: v})}
                        />
                        <ToggleCard
                            icon={Brain}
                            title="Thinking Blocks"
                            description="AI reasoning and thought process"
                            checked={form.streamdownThinkingEnabled}
                            onChange={(v) => onChange({streamdownThinkingEnabled: v})}
                        />
                    </div>
                </div>
            </SettingsCard>
        </div>
    )
}
