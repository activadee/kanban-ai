import {useMemo, useState} from 'react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card as UICard, CardContent} from '@/components/ui/card'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Bot, EllipsisVertical, GitPullRequest, Sparkles, Loader2} from 'lucide-react'
import type {Card as TCard} from 'shared'
import type {CardEnhancementStatus} from '@/hooks/tickets'
import type {CardLane} from './cardLane'
import {
    useCardAttempt,
    useOpenAttemptEditor,
    useStartAttempt,
    useStopAttempt,
    useProjectSettings,
    useAppSettings,
    useEditors,
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
    onEnhancementClick?: () => void
    disabled?: boolean
    menuContext?: KanbanCardMenuContext
}

export function KanbanCard({
                               card,
                               done = false,
                               showAgentComingSoon = false,
                               blocked = false,
                               blockers = [],
                               enhancementStatus,
                               onEnhancementClick,
                               disabled = false,
                               menuContext,
                           }: Props) {
    const isEnhancing = enhancementStatus === 'enhancing'
    const isReady = enhancementStatus === 'ready'

    const showHeaderRow =
        Boolean(card.ticketKey) ||
        showAgentComingSoon ||
        Boolean(card.prUrl) ||
        blocked ||
        isEnhancing ||
        isReady ||
        Boolean(menuContext)

    const cardInner = (
        <UICard
            className={`${
                disabled || isEnhancing ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing'
            } ${blocked && !done ? 'border-destructive/40 bg-rose-50/70 dark:bg-rose-950/10' : ''}`}>
            <CardContent className="p-3">
                {showHeaderRow ? (
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {card.ticketKey ? (
                                <Badge variant="outline" className="text-[10px] font-semibold tracking-tight">
                                    {card.ticketKey}
                                </Badge>
                            ) : null}
                            {blocked && !done ? (
                                <Badge
                                    variant="outline"
                                    className="border-destructive/50 text-destructive"
                                >
                                    Blocked
                                </Badge>
                            ) : null}
                            {isEnhancing ? (
                                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                    <Loader2 className="size-3 animate-spin"/>
                                    Enhancing
                                </Badge>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                            {card.prUrl ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                                aria-label="Open pull request"
                                                className="text-muted-foreground"
                                            >
                                                <a
                                                    href={card.prUrl}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    onClick={(event) => event.stopPropagation()}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                >
                                                    <GitPullRequest className="size-4"/>
                                                </a>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">Open pull request</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {showAgentComingSoon ? (
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled
                                                    aria-label="Review with Agents coming soon"
                                                    className="text-muted-foreground"
                                                >
                                                    <Bot className="size-4"/>
                                                </Button>
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    onEnhancementClick()
                                                }}
                                                aria-label="View enhancement diff"
                                            >
                                                <Sparkles className="size-4"/>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent align="end">
                                            View enhancement diff
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                            {menuContext ? (
                                <KanbanCardMenu card={card} context={menuContext}/>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                <div
                    className={`text-sm font-medium leading-tight ${done ? 'line-through text-muted-foreground' : ''}`}
                >
                    {card.title}
                </div>
            </CardContent>
        </UICard>
    )

    return blockers.length > 0 && blocked && !done ? (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>{cardInner}</TooltipTrigger>
                <TooltipContent align="start" className="max-w-xs">
                    <div className="text-xs">
                        <div className="mb-1 font-medium">Depends on:</div>
                        <ul className="list-inside list-disc space-y-1">
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
    ) : cardInner
}

type MenuProps = {
    card: TCard
    context: KanbanCardMenuContext
}

function KanbanCardMenu({card, context}: MenuProps) {
    const {projectId, lane, blocked, onOpenDetails, onEdit, onEnhanceTicket} = context

    const [menuOpen, setMenuOpen] = useState(false)
    const [prOpen, setPrOpen] = useState(false)

    const projectSettingsQuery = useProjectSettings(projectId)
    const appSettingsQuery = useAppSettings()
    const editorsQuery = useEditors()

    const shouldLoadAttempt = menuOpen && (lane === 'inProgress' || lane === 'review')

    const cardAttemptQuery = useCardAttempt(
        projectId,
        shouldLoadAttempt ? card.id : undefined,
        {
            enabled: shouldLoadAttempt && Boolean(projectId && card.id),
        },
    )

    const attempt = cardAttemptQuery.data?.attempt ?? null

    const installedEditors = useMemo(
        () => (editorsQuery.data ?? []).filter((editor) => editor.installed),
        [editorsQuery.data],
    )
    const defaultEditorKey = appSettingsQuery.data?.editorType ?? ''
    const defaultEditor = useMemo(
        () => installedEditors.find((editor) => editor.key === defaultEditorKey),
        [installedEditors, defaultEditorKey],
    )

    const openButtonDisabledReason = useMemo(() => {
        if (!defaultEditor) return 'Set a default editor in App Settings.'
        if (!attempt) return null
        if (!attempt.worktreePath) {
            return "This attempt's worktree has been cleaned up. Start a new attempt to open an editor."
        }
        return null
    }, [defaultEditor, attempt])

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
            const title = defaultEditor ? `Opening in ${defaultEditor.label}` : 'Opening editor'
            toast({title, description: `${res.command.cmd} ${res.command.args.join(' ')}`})
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
            <DropdownMenu onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={menuAriaLabel}
                        className="ml-1 text-muted-foreground"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <EllipsisVertical className="size-4"/>
                    </Button>
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
                                disabled={!!openButtonDisabledReason}
                                onClick={handleOpenEditor}
                                title={openButtonDisabledReason ?? undefined}
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
