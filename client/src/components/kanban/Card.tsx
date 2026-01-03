import {useEffect, useMemo, useState} from 'react'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Bot, Bookmark, EllipsisVertical, GitPullRequest, Sparkles, Loader2, AlertCircle, Lock, CheckCircle2} from 'lucide-react'
import type {Card as TCard, AttemptStatus} from 'shared'
import type {CardEnhancementStatus} from '@/hooks/tickets'
import type {CardLane} from './cardLane'
import {formatTicketType, ticketTypeBadgeClass, getTicketTypeColor} from '@/lib/ticketTypes'
import {
    useCardAttempt,
    useOpenAttemptEditor,
    useStartAttempt,
    useStopAttempt,
    useProjectSettings,
    useAppSettings,
} from '@/hooks'
import {CreatePrDialog} from '@/components/git/CreatePrDialog'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'

export type KanbanCardMenuContext = {
    projectId: string
    lane: CardLane
    blocked: boolean
    onOpenDetails?: () => void
    onEdit?: () => void
    onEnhanceTicket?: () => void
}

type Props = {
    card: TCard
    done?: boolean
    showAgentComingSoon?: boolean
    blocked?: boolean
    blockers?: string[]
    enhancementStatus?: CardEnhancementStatus
    attemptStatus?: AttemptStatus
    onEnhancementClick?: () => void
    disabled?: boolean
    menuContext?: KanbanCardMenuContext
    selected?: boolean
    isInProgressLane?: boolean
}

export function KanbanCard({
                               card,
                               done = false,
                               showAgentComingSoon = false,
                               blocked = false,
                               blockers = [],
                               enhancementStatus,
                               attemptStatus,
                               onEnhancementClick,
                               disabled = false,
                               menuContext,
                               selected = false,
                               isInProgressLane = false,
                           }: Props) {
    const isEnhancing = enhancementStatus === 'enhancing'
    const isReady = enhancementStatus === 'ready'
    const isFailed = attemptStatus === 'failed'
    const isRunning = attemptStatus === 'running'
    const isSucceeded = attemptStatus === 'succeeded' && !done
    const showAnimatedBorder = isInProgressLane && isRunning
    const isCardDisabled = disabled || isEnhancing || isFailed
    const showType = card.ticketType !== undefined && card.ticketType !== null
    const hasGithubIssue = Boolean(card.githubIssue)
    const isEnhanced = card.isEnhanced

    const cardStateClasses = useMemo(() => {
        const states: string[] = []
        if (isCardDisabled) {
            states.push('cursor-not-allowed')
        } else {
            states.push('cursor-grab active:cursor-grabbing')
        }
        if (selected) states.push('kanban-card--selected')
        // State precedence (highest to lowest): failed > in-progress > succeeded > blocked
        if (isFailed) states.push('kanban-card--failed')
        else if (showAnimatedBorder) states.push('kanban-card--in-progress')
        else if (isSucceeded) states.push('kanban-card--succeeded')
        else if (blocked && !done) states.push('kanban-card--blocked')
        if (done) states.push('kanban-card--done')
        return states.join(' ')
    }, [isCardDisabled, isFailed, blocked, done, selected, showAnimatedBorder, isSucceeded])

    const showHeaderRow =
        Boolean(card.ticketKey) ||
        showType ||
        showAgentComingSoon ||
        Boolean(card.prUrl) ||
        hasGithubIssue ||
        blocked ||
        isEnhancing ||
        isFailed ||
        isSucceeded ||
        isReady ||
        Boolean(menuContext)

    const cardContent = (
        <div 
            className={`kanban-card ${cardStateClasses} hover:shadow-md`}
            data-ticket-type={card.ticketType ?? undefined}
            style={{
                '--ticket-type-color': getTicketTypeColor(card.ticketType),
            } as React.CSSProperties}
        >
            {isEnhanced && (
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="kanban-bookmark" aria-label="Enhanced ticket">
                                <Bookmark className="size-3.5" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent align="end">Enhanced ticket</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            <div className="flex h-full flex-col gap-2.5 p-3 pl-4">
                {showHeaderRow ? (
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {showType ? (
                                <span className={ticketTypeBadgeClass(card.ticketType)}>
                                    {formatTicketType(card.ticketType)}
                                </span>
                            ) : null}
                            {card.ticketKey ? (
                                <span className="kanban-badge kanban-badge--key">
                                    {card.ticketKey}
                                </span>
                            ) : null}
                            {card.githubIssue ? (
                                <a
                                    href={card.githubIssue.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="kanban-badge kanban-badge--key hover:bg-accent hover:text-accent-foreground transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    #{card.githubIssue.issueNumber}
                                </a>
                            ) : null}

                            {blocked && !done ? (
                                <span className="kanban-indicator--blocked">
                                    <Lock className="size-2.5" />
                                    Blocked
                                </span>
                            ) : null}
                            {isEnhancing ? (
                                <span className="kanban-spinner">
                                    <Loader2 className="size-2.5 animate-spin"/>
                                    Enhancing
                                </span>
                            ) : null}
                            {isFailed ? (
                                <span className="kanban-indicator--failed">
                                    <AlertCircle className="size-2.5" />
                                    Failed
                                </span>
                            ) : null}
                            {isSucceeded ? (
                                <span className="kanban-indicator--succeeded" aria-label="Attempt succeeded">
                                    <CheckCircle2 className="size-2.5" />
                                    Succeeded
                                </span>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-0.5 -mr-1">
                            {card.prUrl ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <a
                                                href={card.prUrl}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                onClick={(event) => event.stopPropagation()}
                                                onPointerDown={(event) => event.stopPropagation()}
                                                className="kanban-card-action kanban-card-action--pr"
                                                aria-label="Open pull request"
                                            >
                                                <GitPullRequest className="size-3.5"/>
                                            </a>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">Open pull request</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {showAgentComingSoon ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="kanban-card-action opacity-40 cursor-not-allowed">
                                                <Bot className="size-3.5"/>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">
                                            Review with Agents coming soon
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {isReady && onEnhancementClick ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="kanban-card-action kanban-card-action--sparkle"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    onEnhancementClick()
                                                }}
                                                aria-label="View enhancement diff"
                                            >
                                                <Sparkles className="size-3.5"/>
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">
                                            View enhancement diff
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {menuContext ? (
                                <KanbanCardMenu card={card} context={menuContext} disabled={isCardDisabled}/>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                <div
                    title={card.title}
                    className={`truncate text-[13px] font-medium leading-snug tracking-tight ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                >
                    {card.title}
                </div>
            </div>
        </div>
    )

    return blockers.length > 0 && blocked && !done ? (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
                <TooltipContent align="start" className="max-w-xs">
                    <div className="text-xs">
                        <div className="mb-1.5 font-semibold flex items-center gap-1.5">
                            <Lock className="size-3" />
                            Depends on:
                        </div>
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            {blockers.map((b) => (
                                <li key={b} className="truncate">
                                    {b}
                                </li>
                            ))}
                        </ul>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : cardContent
}

type MenuProps = {
    card: TCard
    context: KanbanCardMenuContext
    disabled?: boolean
}

function KanbanCardMenu({card, context, disabled = false}: MenuProps) {
    const {projectId, lane, blocked, onOpenDetails, onEdit, onEnhanceTicket} = context

    const [menuOpen, setMenuOpen] = useState(false)
    const [prOpen, setPrOpen] = useState(false)

    useEffect(() => {
        if (!disabled) return
        setMenuOpen(false)
        setPrOpen(false)
    }, [disabled])

    const projectSettingsQuery = useProjectSettings(projectId)
    const appSettingsQuery = useAppSettings()

    const shouldLoadAttempt =
        (menuOpen || prOpen) && (lane === 'inProgress' || lane === 'review')

    const cardAttemptQuery = useCardAttempt(
        projectId,
        shouldLoadAttempt ? card.id : undefined,
        {
            enabled: shouldLoadAttempt && Boolean(projectId && card.id),
        },
    )

    const attempt = cardAttemptQuery.data?.attempt ?? null

    const editorCommand = appSettingsQuery.data?.editorCommand

    const openButtonDisabledReason = useMemo(() => {
        if (!editorCommand) return 'Set an editor executable in App Settings.'
        if (!attempt) return null
        if (!attempt.worktreePath) {
            return "This attempt's worktree has been cleaned up. Start a new attempt to open an editor."
        }
        return null
    }, [editorCommand, attempt])

    const prDefaults = useMemo(() => {
        const settings = appSettingsQuery.data
        const autolink = settings?.ghAutolinkTickets ?? true
        const titleTmpl = settings?.ghPrTitleTemplate || (autolink ? '[{ticketKey}] {title}' : '{title}')
        const bodyTmpl = settings?.ghPrBodyTemplate || ''
        const tokens: Record<string, string> = {
            ticketKey: card.ticketKey ?? '',
            title: card.title,
            branch: attempt?.branchName ?? '',
            attemptId: attempt?.id ?? '',
        }
        const render = (tmpl: string) => tmpl.replace(/\{(\w+)\}/g, (_: string, k: string) => tokens[k] ?? '')
        return {
            title: render(titleTmpl).trim(),
            body: render(bodyTmpl).trim(),
        }
    }, [appSettingsQuery.data, card.ticketKey, card.title, attempt?.branchName, attempt?.id])

    const projectDefaultAgent = useMemo(() => {
        const raw = projectSettingsQuery.data?.defaultAgent
        if (typeof raw !== 'string') return undefined
        const trimmed = raw.trim()
        return trimmed.length ? trimmed : undefined
    }, [projectSettingsQuery.data?.defaultAgent])

    const projectDefaultProfileId = useMemo(() => {
        const raw = projectSettingsQuery.data?.defaultProfileId
        if (typeof raw !== 'string') return undefined
        const trimmed = raw.trim()
        return trimmed.length ? trimmed : undefined
    }, [projectSettingsQuery.data?.defaultProfileId])

    const startAttemptMutation = useStartAttempt()
    const stopAttemptMutation = useStopAttempt()
    const openEditorMutation = useOpenAttemptEditor()

    const hasRunningAttempt = attempt?.status === 'running'
    const canCreatePr = Boolean(attempt?.branchName)

    const handleStartWork = async () => {
        if (blocked) {
            toast({
                title: 'Task is blocked by dependencies',
                description: 'Complete required dependencies before moving this card to In Progress.',
                variant: 'destructive',
            })
            return
        }

        if (!projectDefaultAgent) {
            toast({
                title: 'No default agent configured',
                description: 'Configure a default agent in Project Settings to start work from the board.',
                variant: 'default',
            })
            return
        }

        try {
            await startAttemptMutation.mutateAsync({
                projectId,
                cardId: card.id,
                agent: projectDefaultAgent,
                profileId: projectDefaultProfileId,
            })
        } catch (err) {
            console.error('Start attempt failed', err)
            const {title, description} = describeApiError(err, 'Failed to start work')
            toast({title, description, variant: 'destructive'})
        }
    }

    const handleStopAttempt = async () => {
        if (!attempt || !hasRunningAttempt) return
        try {
            await stopAttemptMutation.mutateAsync({attemptId: attempt.id})
        } catch (err) {
            console.error('Stop attempt failed', err)
            const {title, description} = describeApiError(err, 'Failed to stop Attempt')
            toast({title, description, variant: 'destructive'})
        }
    }

    const handleOpenEditor = async () => {
        if (!attempt || openButtonDisabledReason) return
        try {
            const res = await openEditorMutation.mutateAsync({attemptId: attempt.id})
            toast({title: 'Opening editor', description: `${res.command.cmd} ${res.command.args.join(' ')}`})
        } catch (err) {
            console.error('Open editor failed', err)
            const {title, description} = describeApiError(err, 'Open failed')
            toast({title, description, variant: 'destructive'})
        }
    }

    const handleOpenDetails = () => {
        onOpenDetails?.()
    }

    const handleEdit = () => {
        onEdit?.()
    }

    const hasBacklogActions = lane === 'backlog'
    const hasInProgressActions = lane === 'inProgress'
    const hasReviewActions = lane === 'review'

    const anyLaneActions = hasBacklogActions || hasInProgressActions || hasReviewActions

    const menuAriaLabel =
        card.ticketKey && card.ticketKey.trim().length
            ? `Ticket ${card.ticketKey} menu`
            : `Ticket ${card.title} menu`

    return (
        <>
            <DropdownMenu
                open={disabled ? false : menuOpen}
                onOpenChange={(open) => {
                    if (disabled) return
                    setMenuOpen(open)
                }}
            >
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="kanban-card-action"
                        aria-label={menuAriaLabel}
                        disabled={disabled}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <EllipsisVertical className="size-3.5"/>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Ticket actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={handleOpenDetails}>
                        Open details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEdit}>
                        Edit…
                    </DropdownMenuItem>
                    {anyLaneActions ? <DropdownMenuSeparator/> : null}
                    {hasBacklogActions && (
                        <>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Backlog actions
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                disabled={!card.title.trim()}
                                onClick={() => {
                                    if (!card.title.trim()) return
                                    onEnhanceTicket ? onEnhanceTicket() : handleEdit()
                                }}
                            >
                                Enhance ticket…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={startAttemptMutation.isPending || !projectDefaultAgent}
                                onClick={handleStartWork}
                                title={
                                    !projectDefaultAgent
                                        ? 'Configure a default agent in Project Settings to start work from the board.'
                                        : undefined
                                }
                            >
                                Start work
                            </DropdownMenuItem>
                        </>
                    )}
                    {hasInProgressActions && (
                        <>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                In Progress actions
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                disabled={!hasRunningAttempt || stopAttemptMutation.isPending}
                                onClick={handleStopAttempt}
                                title={
                                    !hasRunningAttempt
                                        ? 'No running Attempt for this ticket.'
                                        : undefined
                                }
                            >
                                Stop Attempt
                            </DropdownMenuItem>
                        </>
                    )}
                    {hasReviewActions && (
                        <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Review actions
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                disabled={!canCreatePr}
                                onClick={() => {
                                    if (canCreatePr) setPrOpen(true)
                                }}
                            >
                                Create PR…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={!attempt || !!openButtonDisabledReason}
                                onClick={handleOpenEditor}
                                title={
                                    !attempt
                                        ? 'Start an Attempt before opening the editor.'
                                        : openButtonDisabledReason ?? undefined
                                }
                            >
                                Open in editor
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {hasReviewActions && (
                <CreatePrDialog
                    projectId={projectId}
                    attemptId={attempt?.id}
                    cardId={card.id}
                    branch={attempt?.branchName}
                    baseBranch={attempt?.baseBranch}
                    defaultTitle={prDefaults.title}
                    defaultBody={prDefaults.body}
                    open={prOpen && Boolean(attempt?.id)}
                    onOpenChange={setPrOpen}
                />
            )}
        </>
    )
}
