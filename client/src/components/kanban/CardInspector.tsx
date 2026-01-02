import {useEffect, useRef, useState} from 'react'
import type {Card as TCard} from 'shared'
import {LogsPane} from './card-inspector/LogsPane'
import {InspectorHeader} from './card-inspector/InspectorHeader'
import {AttemptCreateForm} from './card-inspector/AttemptCreateForm'
import {GitSection} from './card-inspector/sections/GitSection'
import {AttemptsSection} from './card-inspector/sections/AttemptsSection'
import {ActivitySection} from './card-inspector/sections/ActivitySection'
import {useCardInspectorState} from './card-inspector/useCardInspectorState'
import type {CardFormValues} from './CardDialogs'
import {AttemptToolbar} from './card-inspector/AttemptToolbar'
import {TicketDetailsPanel} from './card-inspector/TicketDetailsPanel'
import {getTicketTypeColor} from '@/lib/ticketTypes'
import {cn} from '@/lib/utils'
import {Sheet, SheetContent, SheetHeader, SheetTitle} from '@/components/ui/sheet'
import {Layers, ScrollText} from 'lucide-react'

type ViewMode = 'conversation' | 'details'

export function CardInspector({
                                  projectId,
                                  card,
                                  locked = false,
                                  blocked = false,
                                  availableCards = [],
                                  cardsIndex,
                                  onUpdate,
                                  onDelete,
                                  onClose,
                                  onEnhanceCard,
                              }: {
    projectId: string
    card: TCard
    locked?: boolean
    blocked?: boolean
    availableCards?: { id: string; title: string; ticketKey?: string }[]
    cardsIndex?: Map<string, { id: string; title: string; ticketKey?: string }>
    onUpdate: (values: CardFormValues) => Promise<void> | void
    onDelete: () => Promise<void> | void
    onClose?: () => void
    onEnhanceCard?: (values: CardFormValues) => Promise<void> | void
}) {
    const previousCardIdRef = useRef(card.id)
    const previousAttemptIdRef = useRef<string | undefined>(undefined)

    const inspectorState = useCardInspectorState({
        projectId,
        card,
        locked,
        blocked,
        availableCards,
        cardsIndex,
        onUpdate,
        onDelete,
    })

    const {details, header, attempt, git, activity} = inspectorState

    const [viewMode, setViewMode] = useState<ViewMode>('conversation')
    const [processesOpen, setProcessesOpen] = useState(false)
    const [logsOpen, setLogsOpen] = useState(false)

    useEffect(() => {
        const cardChanged = previousCardIdRef.current !== card.id
        if (cardChanged) {
            previousCardIdRef.current = card.id
            setViewMode(attempt.attempt ? 'conversation' : 'details')
            setProcessesOpen(false)
            setLogsOpen(false)
        }
    }, [card.id, attempt.attempt?.id])

    useEffect(() => {
        const currentAttemptId = attempt.attempt?.id
        if (previousAttemptIdRef.current !== currentAttemptId && currentAttemptId) {
            setViewMode('conversation')
            previousAttemptIdRef.current = currentAttemptId
        }
    }, [attempt.attempt?.id])

    const accentColor = getTicketTypeColor(card.ticketType)
    const hasAttempt = Boolean(attempt.attempt)

    return (
        <div 
            className={cn(
                "inspector-panel group/inspector relative flex h-full flex-col",
                "bg-gradient-to-b from-background via-background to-muted/20",
            )}
            style={{'--inspector-accent': accentColor} as React.CSSProperties}
        >
            <div 
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg opacity-80 transition-opacity group-hover/inspector:opacity-100"
                style={{backgroundColor: accentColor || 'var(--border)'}}
            />
            
            <div className="flex h-full flex-col gap-0 pl-3">
                <div className="shrink-0 border-b border-border/40 pb-3 pt-1">
                    <InspectorHeader
                        card={card}
                        locked={locked}
                        blocked={blocked}
                        copied={header.copied}
                        onCopyTicketKey={header.handleCopyTicketKey}
                        onClose={onClose}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        hasAttempt={hasAttempt}
                        actions={
                            attempt.attempt ? (
                                <AttemptToolbar
                                    attempt={attempt.attempt}
                                    openButtonDisabledReason={git.openButtonDisabledReason}
                                    onOpenEditor={git.handleOpenEditor}
                                    todoSummary={git.todoSummary}
                                    onOpenChanges={() => git.setChangesOpen(true)}
                                    onOpenCommit={() => git.setCommitOpen(true)}
                                    onOpenPr={() => git.setPrOpen(true)}
                                    onOpenMerge={() => git.setMergeOpen(true)}
                                    onOpenProcesses={() => setProcessesOpen(true)}
                                    onOpenLogs={() => setLogsOpen(true)}
                                />
                            ) : null
                        }
                    />
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                    {viewMode === 'details' ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto py-4 pr-3">
                            <TicketDetailsPanel
                                values={details.values}
                                locked={locked}
                                availableCards={availableCards}
                                cardsIndex={cardsIndex}
                                onChangeValues={(patch: Partial<typeof details.values>) => details.setValues((prev) => ({...prev, ...patch}))}
                                onSave={details.handleSave}
                                onDelete={details.handleDelete}
                                saving={details.saving}
                                deleting={details.deleting}
                                existingImages={details.existingImages}
                                imagesLoading={details.imagesLoading}
                                pendingImages={details.pendingImages}
                                onAddImages={details.addImages}
                                onRemoveImage={details.removeImage}
                                canAddMoreImages={details.canAddMoreImages}
                                onEnhanceInBackground={
                                    onEnhanceCard
                                        ? async () => {
                                            await details.handleSave()
                                            await onEnhanceCard({
                                                title: details.values.title.trim(),
                                                description: details.values.description.trim(),
                                                dependsOn: details.values.dependsOn,
                                                ticketType: details.values.ticketType ?? null,
                                                images: details.pendingImages.length > 0 ? details.pendingImages : undefined,
                                            })
                                            details.clearImages()
                                        }
                                        : undefined
                                }
                            />
                            
                            {!attempt.attempt && (
                                <div className="mt-auto pt-4 border-t border-border/30">
                                    <AttemptCreateForm
                                        agents={attempt.agents}
                                        agent={attempt.agent}
                                        onAgentChange={attempt.handleAgentSelect}
                                        availableProfiles={attempt.availableProfiles}
                                        profileId={attempt.profileId}
                                        onProfileChange={(id) => attempt.handleProfileSelect(id ?? '__default__')}
                                        onStart={attempt.startAttempt}
                                        locked={locked}
                                        blocked={blocked}
                                        starting={attempt.starting}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col">
                            {!attempt.attempt ? (
                                <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
                                    <div className="text-center space-y-2">
                                        <h3 className="text-lg font-semibold tracking-tight">Start an Attempt</h3>
                                        <p className="text-sm text-muted-foreground max-w-sm">
                                            Choose an agent to begin working on this ticket. The agent will create a worktree and start coding.
                                        </p>
                                    </div>
                                    <AttemptCreateForm
                                        agents={attempt.agents}
                                        agent={attempt.agent}
                                        onAgentChange={attempt.handleAgentSelect}
                                        availableProfiles={attempt.availableProfiles}
                                        profileId={attempt.profileId}
                                        onProfileChange={(id) => attempt.handleProfileSelect(id ?? '__default__')}
                                        onStart={attempt.startAttempt}
                                        locked={locked}
                                        blocked={blocked}
                                        starting={attempt.starting}
                                    />
                                </div>
                            ) : (
                                <AttemptsSection
                                    attempt={attempt.attempt}
                                    cardId={card.id}
                                    locked={locked}
                                    conversation={attempt.conversation}
                                    followup={attempt.followup}
                                    onFollowupChange={attempt.setFollowup}
                                    onSendFollowup={attempt.sendFollowup}
                                    sendPending={attempt.sendFollowupPending}
                                    stopping={attempt.stopping}
                                    onStopAttempt={attempt.stopAttempt}
                                    onRetryAttempt={attempt.attempt?.status === 'failed' ? attempt.retryAttempt : undefined}
                                    retrying={attempt.retrying}
                                    attemptAgent={attempt.attemptAgent}
                                    profileId={attempt.profileId}
                                    onProfileSelect={attempt.handleProfileSelect}
                                    followupProfiles={attempt.followupProfiles}
                                    pendingImages={attempt.pendingImages}
                                    addImages={attempt.addImages}
                                    removeImage={attempt.removeImage}
                                    canAddMoreImages={attempt.canAddMoreImages}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Sheet open={processesOpen} onOpenChange={setProcessesOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Processes
                        </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 flex-1 overflow-auto">
                        <ActivitySection
                            attempt={attempt.attempt}
                            agent={attempt.agent}
                            stopping={attempt.stopping}
                            onStopAttempt={attempt.stopAttempt}
                            latestDevAutomation={activity.latestDevAutomation}
                            devScriptConfigured={activity.devScriptConfigured}
                            devAutomationPending={activity.devAutomationPending}
                            onRunDevScript={activity.runDevScript}
                            onViewLogs={() => {
                                setProcessesOpen(false)
                                setLogsOpen(true)
                            }}
                        />
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
                <SheetContent side="right" className="w-full sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <ScrollText className="h-4 w-4" />
                            Logs
                        </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 flex-1 overflow-auto">
                        <LogsPane logs={attempt.logs} />
                    </div>
                </SheetContent>
            </Sheet>

            <GitSection
                projectId={projectId}
                card={card}
                attempt={attempt.attempt}
                changesOpen={git.changesOpen}
                onChangesOpenChange={git.setChangesOpen}
                commitOpen={git.commitOpen}
                onCommitOpenChange={git.setCommitOpen}
                prOpen={git.prOpen}
                onPrOpenChange={git.setPrOpen}
                mergeOpen={git.mergeOpen}
                onMergeOpenChange={git.setMergeOpen}
                prDefaults={git.prDefaults}
            />
        </div>
    )
}
