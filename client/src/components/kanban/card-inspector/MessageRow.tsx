import {useState} from 'react'
import type {ConversationItem} from 'shared'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {decodeBase64Stream} from '@/lib/encoding'
import {CollapsibleThinkingBlock} from '@/components/kanban/conversation/CollapsibleThinkingBlock'
import {ImageAttachment} from '@/components/ui/image-attachment'
import {Streamdown} from 'streamdown'
import {
    User,
    Bot,
    AlertCircle,
    Terminal,
    Cog,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    Copy,
    FolderCog,
    Wrench,
    Trash2,
    FileCode2,
    Ban,
    Eye,
    EyeOff,
} from 'lucide-react'

function RoleAvatar({role}: {role: 'user' | 'assistant' | 'system'}) {
    const iconClasses = 'h-4 w-4'
    switch (role) {
        case 'user':
            return (
                <div
                    data-slot="message-avatar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm"
                >
                    <User className={iconClasses} />
                </div>
            )
        case 'assistant':
            return (
                <div
                    data-slot="message-avatar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm"
                >
                    <Bot className={iconClasses} />
                </div>
            )
        case 'system':
            return (
                <div
                    data-slot="message-avatar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground"
                >
                    <Cog className={iconClasses} />
                </div>
            )
    }
}

function StatusIndicator({status}: {status: 'created' | 'running' | 'succeeded' | 'failed' | 'cancelled'}) {
    const baseClasses = 'flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full'
    switch (status) {
        case 'succeeded':
            return (
                <span data-slot="status-indicator" className={cn(baseClasses, 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')}>
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    done
                </span>
            )
        case 'failed':
            return (
                <span data-slot="status-indicator" className={cn(baseClasses, 'bg-destructive/15 text-destructive')}>
                    <XCircle className="h-2.5 w-2.5" />
                    failed
                </span>
            )
        case 'running':
            return (
                <span data-slot="status-indicator" className={cn(baseClasses, 'bg-blue-500/15 text-blue-600 dark:text-blue-400')}>
                    <Play className="h-2.5 w-2.5 animate-pulse" />
                    running
                </span>
            )
        case 'cancelled':
            return (
                <span data-slot="status-indicator" className={cn(baseClasses, 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
                    <Ban className="h-2.5 w-2.5" />
                    cancelled
                </span>
            )
        default:
            return (
                <span data-slot="status-indicator" className={cn(baseClasses, 'bg-muted text-muted-foreground')}>
                    <Clock className="h-2.5 w-2.5" />
                    pending
                </span>
            )
    }
}

function AutomationStageIcon({stage}: {stage: 'copy_files' | 'setup' | 'dev' | 'cleanup'}) {
    const iconClasses = 'h-3.5 w-3.5'
    switch (stage) {
        case 'copy_files':
            return <Copy className={iconClasses} />
        case 'setup':
            return <FolderCog className={iconClasses} />
        case 'dev':
            return <FileCode2 className={iconClasses} />
        case 'cleanup':
            return <Trash2 className={iconClasses} />
    }
}

function CollapsibleSection({
    children,
    header,
    defaultOpen = false,
    className,
    variant = 'default',
}: {
    children: React.ReactNode
    header: React.ReactNode
    defaultOpen?: boolean
    className?: string
    variant?: 'default' | 'tool' | 'automation' | 'error'
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    const variantStyles = {
        default: 'border-border/50 bg-card/50',
        tool: 'border-slate-500/20 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/20',
        automation: 'border-amber-500/20 bg-gradient-to-r from-amber-50/30 to-transparent dark:from-amber-950/10',
        error: 'border-destructive/30 bg-destructive/5',
    }

    return (
        <div
            data-slot="collapsible-section"
            className={cn(
                'group mb-2 overflow-hidden rounded-lg border transition-all duration-200',
                variantStyles[variant],
                isOpen && 'shadow-sm',
                className,
            )}
        >
            <button
                type="button"
                data-slot="collapsible-header"
                onClick={() => setIsOpen(v => !v)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {header}
                </div>
                <span
                    data-slot="collapsible-toggle"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/70"
                >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
            </button>
            <div
                data-slot="collapsible-content"
                className={cn(
                    'grid transition-all duration-200 ease-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
            >
                <div className="overflow-hidden">
                    <div className="border-t border-border/30 px-3 py-2.5">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}

function OutputSection({
    stdout,
    stderr,
    decode = false,
}: {
    stdout?: string | null
    stderr?: string | null
    decode?: boolean
}) {
    const [revealed, setRevealed] = useState(false)
    const hasOutput = stdout || stderr

    if (!hasOutput) return null

    const processOutput = (text: string) => decode ? decodeBase64Stream(text) : text

    return (
        <div data-slot="output-section" className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">Output</span>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRevealed(v => !v)}
                    className="h-5 px-1.5 text-[10px] gap-1"
                    data-slot="output-toggle"
                >
                    {revealed ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    {revealed ? 'Hide' : 'Show'}
                </Button>
            </div>
            {revealed && (
                <div data-slot="output-content" className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                    {stdout && (
                        <div>
                            <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">stdout</div>
                            <pre className="max-h-40 overflow-auto rounded-md bg-slate-950 p-2.5 font-mono text-[11px] text-slate-200 dark:bg-slate-900/80">
                                {processOutput(stdout)}
                            </pre>
                        </div>
                    )}
                    {stderr && (
                        <div>
                            <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-rose-500">stderr</div>
                            <pre className="max-h-40 overflow-auto rounded-md bg-slate-950 p-2.5 font-mono text-[11px] text-rose-300 dark:bg-slate-900/80">
                                {processOutput(stderr)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export type MessageRowProps = {
    item: ConversationItem
    agentKey?: string
    profiles?: Array<{ id: string; name: string }>
}

function resolveProfileDisplay(
    profileId: string | undefined,
    agentKey: string | undefined,
    profiles: Array<{ id: string; name: string }> | undefined,
): string | null {
    if (!profileId) return null
    
    const profile = profiles?.find(p => p.id === profileId)
    const displayName = profile?.name ?? profileId
    
    if (agentKey) {
        return `${agentKey}/${displayName}`
    }
    return displayName
}

export function MessageRow({item, agentKey, profiles}: MessageRowProps) {
    const timestamp = Number.isNaN(Date.parse(item.timestamp)) ? new Date() : new Date(item.timestamp)
    const time = timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})

    switch (item.type) {
        case 'message': {
            const {role, text, images} = item
            const isUser = role === 'user'
            const isSystem = role === 'system'

            return (
                <div
                    data-slot="message-row"
                    data-role={role}
                    className={cn(
                        'mb-3 flex gap-2.5 animate-in fade-in-50 slide-in-from-bottom-1 duration-200',
                        isUser && 'flex-row-reverse',
                    )}
                >
                    <RoleAvatar role={role} />
                    <div
                        data-slot="message-bubble"
                        className={cn(
                            'group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm',
                            isUser && 'rounded-tr-md bg-gradient-to-br from-teal-600 to-cyan-700 text-white',
                            role === 'assistant' && 'rounded-tl-md bg-muted/60 text-foreground border border-border/40',
                            isSystem && 'rounded-tl-md border border-dashed border-border/60 bg-transparent text-muted-foreground',
                        )}
                    >
                        <div className="mb-1 flex items-center gap-2">
                            <span
                                data-slot="message-role"
                                className={cn(
                                    'text-[9px] font-semibold uppercase tracking-wider',
                                    isUser && 'text-white/60',
                                    role === 'assistant' && 'text-violet-600 dark:text-violet-400',
                                    isSystem && 'text-muted-foreground/70',
                                )}
                            >
                                {role}
                            </span>
                            <span
                                data-slot="message-time"
                                className={cn(
                                    'text-[9px] tabular-nums',
                                    isUser ? 'text-white/40' : 'text-muted-foreground/50',
                                )}
                            >
                                {time}
                            </span>
                            {item.profileId && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'h-3.5 gap-0.5 px-1 text-[8px]',
                                        isUser && 'border-white/20 text-white/60',
                                    )}
                                >
                                    <Bot className="h-2 w-2" />
                                    {resolveProfileDisplay(item.profileId, agentKey, profiles) ?? item.profileId}
                                </Badge>
                            )}
                        </div>
                        <Streamdown
                            data-slot="message-text"
                            className={cn(
                                'prose prose-sm max-w-none',
                                isUser 
                                    ? 'prose-invert prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:text-white/90 prose-code:bg-white/10'
                                    : 'dark:prose-invert',
                            )}
                            shikiTheme={['github-light', 'github-dark']}
                        >
                            {text}
                        </Streamdown>
                        {images && images.length > 0 && (
                            <ImageAttachment images={images} variant="badge" size="sm" className="mt-2" />
                        )}
                    </div>
                </div>
            )
        }

        case 'thinking': {
            const firstLine = item.text.split('\n')[0]?.trim()
            const summaryLabel = item.title?.trim() || firstLine || 'thinking'
            const ariaLabel = item.title ? `thinking: ${item.title}` : 'thinking'
            return (
                <CollapsibleThinkingBlock
                    ariaLabel={ariaLabel}
                    headerLeft={(
                        <>
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                <Cog className="h-3 w-3" />
                            </div>
                            <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-600 dark:text-amber-400"
                            >
                                thinking
                            </Badge>
                            <span
                                data-slot="thinking-title"
                                className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/70"
                            >
                                {summaryLabel}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60 tabular-nums">{time}</span>
                        </>
                    )}
                    className="message-row-thinking mb-2 border-amber-500/20 bg-gradient-to-r from-amber-50/30 to-transparent dark:from-amber-950/10"
                    contentClassName="leading-relaxed"
                >
                    <Streamdown
                        className="prose prose-sm max-w-none dark:prose-invert"
                        shikiTheme={['github-light', 'github-dark']}
                    >
                        {item.text}
                    </Streamdown>
                </CollapsibleThinkingBlock>
            )
        }

        case 'tool': {
            const {tool} = item
            return (
                <CollapsibleSection
                    variant="tool"
                    header={(
                        <>
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-500/15 text-slate-600 dark:text-slate-400">
                                {tool.name === 'bash' || tool.name === 'Bash' ? (
                                    <Terminal className="h-3 w-3" />
                                ) : (
                                    <Wrench className="h-3 w-3" />
                                )}
                            </div>
                            <Badge
                                variant="outline"
                                className="border-slate-500/20 bg-slate-500/10 text-[9px] text-slate-600 dark:text-slate-400"
                            >
                                {tool.name || 'tool'}
                            </Badge>
                            <StatusIndicator status={tool.status} />
                            <span className="ml-auto text-[9px] text-muted-foreground/60 tabular-nums">{time}</span>
                        </>
                    )}
                >
                    <div data-slot="tool-details" className="space-y-2.5 text-xs">
                        {tool.command && (
                            <div>
                                <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
                                    Command
                                </div>
                                <div className="rounded-md bg-slate-950 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 dark:bg-slate-900/80">
                                    {tool.command}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {tool.cwd && (
                                <span>
                                    cwd: <code className="font-mono text-foreground/70">{tool.cwd}</code>
                                </span>
                            )}
                            {typeof tool.exitCode === 'number' && (
                                <span>
                                    exit: <code className={cn(
                                        'font-mono',
                                        tool.exitCode === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                                    )}>{tool.exitCode}</code>
                                </span>
                            )}
                            {typeof tool.durationMs === 'number' && (
                                <span>
                                    duration: <code className="font-mono text-foreground/70">
                                        {(tool.durationMs / 1000).toFixed(1)}s
                                    </code>
                                </span>
                            )}
                        </div>
                        <OutputSection stdout={tool.stdout} stderr={tool.stderr} decode />
                    </div>
                </CollapsibleSection>
            )
        }

        case 'automation': {
            const stageLabels: Record<typeof item.stage, string> = {
                copy_files: 'Copy Files',
                setup: 'Setup',
                dev: 'Development',
                cleanup: 'Cleanup',
            }
            const automationStatus = item.status === 'succeeded' ? 'succeeded'
                : item.status === 'failed' ? 'failed'
                : 'running'

            return (
                <CollapsibleSection
                    variant="automation"
                    defaultOpen
                    header={(
                        <>
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                <AutomationStageIcon stage={item.stage} />
                            </div>
                            <Badge
                                variant="outline"
                                className="border-amber-500/20 bg-amber-500/10 text-[9px] text-amber-600 dark:text-amber-400"
                            >
                                {stageLabels[item.stage]}
                            </Badge>
                            <StatusIndicator status={automationStatus} />
                            {item.allowedFailure && item.status === 'failed' && (
                                <Badge
                                    variant="outline"
                                    className="border-amber-500/30 text-[8px] text-amber-600 dark:text-amber-400"
                                >
                                    allowed
                                </Badge>
                            )}
                            <span className="ml-auto text-[9px] text-muted-foreground/60 tabular-nums">{time}</span>
                        </>
                    )}
                >
                    <div data-slot="automation-details" className="space-y-2.5 text-xs">
                        <div>
                            <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
                                Command
                            </div>
                            <div className="rounded-md bg-slate-950 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 dark:bg-slate-900/80">
                                {item.command}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>
                                cwd: <code className="font-mono text-foreground/70">{item.cwd}</code>
                            </span>
                            <span>
                                exit: <code className={cn(
                                    'font-mono',
                                    item.exitCode === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                                )}>{item.exitCode ?? 'n/a'}</code>
                            </span>
                            <span>
                                duration: <code className="font-mono text-foreground/70">
                                    {Number.isFinite(item.durationMs) ? `${(item.durationMs / 1000).toFixed(1)}s` : 'n/a'}
                                </code>
                            </span>
                        </div>
                        <OutputSection stdout={item.stdout} stderr={item.stderr} />
                    </div>
                </CollapsibleSection>
            )
        }

        case 'error': {
            return (
                <div
                    data-slot="error-row"
                    className="mb-3 flex gap-2.5 animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
                >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                    <div
                        data-slot="error-bubble"
                        className="max-w-[85%] rounded-2xl rounded-tl-md border border-destructive/30 bg-destructive/5 px-3.5 py-2.5"
                    >
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-destructive">
                                Error
                            </span>
                            <span className="text-[9px] text-destructive/50 tabular-nums">{time}</span>
                        </div>
                        <div
                            data-slot="error-text"
                            className="whitespace-pre-wrap text-sm leading-relaxed text-destructive"
                        >
                            {item.text}
                        </div>
                    </div>
                </div>
            )
        }

        default:
            return null
    }
}
