import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {Bot, Plug, Server, AlertTriangle} from 'lucide-react'
import {cn} from '@/lib/utils'

export type OpencodeAgentForm = {opencodePort: number}

const RESERVED_PORTS = [80, 443, 22, 25, 53, 110, 143, 993, 995, 3306, 5432, 6379, 8080, 8443]

export function isValidPort(port: number): boolean {
    return port >= 1 && port <= 65535 && !RESERVED_PORTS.includes(port)
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

export function OpencodeAgentSettingsSection({form, onChange}: {
    form: OpencodeAgentForm;
    onChange: (patch: Partial<OpencodeAgentForm>) => void
}) {
    const portValue = form.opencodePort
    const isValid = isValidPort(portValue)
    const isReserved = RESERVED_PORTS.includes(portValue)
    const isOutOfRange = portValue < 1 || portValue > 65535

    return (
        <div className="space-y-6">
            <SectionHeader
                icon={Bot}
                title="OpenCode Agent"
                description="Configure the OpenCode agent connection settings"
            />

            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                <div className="relative p-5">
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm',
                            isValid
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                        )}>
                            <Plug className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold">
                                    Port {portValue}
                                </span>
                                <Badge
                                    variant={isValid ? 'secondary' : 'outline'}
                                    className={cn(
                                        'h-5 gap-1 px-1.5 text-[10px]',
                                        isValid
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
                                    )}
                                >
                                    {isValid ? 'Valid' : 'Invalid'}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                OpenCode agent will listen on this port for connections.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Server className="h-3.5 w-3.5" />
                        <span>Connection Settings</span>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="opencodePort" className="text-sm font-medium">
                            Server Port
                        </Label>
                        <div className="relative max-w-xs">
                            <Input
                                id="opencodePort"
                                type="number"
                                min={1}
                                max={65535}
                                value={form.opencodePort}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10)
                                    onChange({opencodePort: isNaN(val) ? 4097 : val})
                                }}
                                className={cn(
                                    'h-10 pr-16 font-mono tabular-nums transition-all focus:ring-2',
                                    isValid
                                        ? 'focus:ring-primary/20'
                                        : 'border-destructive/50 focus:ring-destructive/20'
                                )}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-muted-foreground">
                                TCP
                            </div>
                        </div>

                        {!isValid && (
                            <div className="flex items-start gap-2 text-xs text-destructive">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                    {isOutOfRange
                                        ? 'Port must be between 1 and 65535.'
                                        : isReserved
                                            ? 'This port is reserved. Please choose a different port.'
                                            : 'Invalid port number.'}
                                </span>
                            </div>
                        )}

                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Default: 4097. Choose an available port that isn&apos;t in use by other services.
                        </p>
                    </div>
                </div>
            </SettingsCard>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="space-y-3">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Reserved Ports (Cannot Use)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {RESERVED_PORTS.map((port) => (
                            <Badge
                                key={port}
                                variant="outline"
                                className={cn(
                                    'border-dashed px-2 py-0.5 font-mono text-[10px]',
                                    port === portValue && 'border-destructive/50 bg-destructive/5 text-destructive'
                                )}
                            >
                                {port}
                            </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        These ports are commonly used by system services and should be avoided.
                    </p>
                </div>
            </div>
        </div>
    )
}
