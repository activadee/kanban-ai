import {useEffect, useRef, useState} from 'react'
import type {Card as TCard} from 'shared'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {LogsPane} from './card-inspector/LogsPane'
import {InspectorHeader} from './card-inspector/InspectorHeader'
import {AttemptCreateForm} from './card-inspector/AttemptCreateForm'
import {DetailsSection} from './card-inspector/sections/DetailsSection'
import {GitSection} from './card-inspector/sections/GitSection'
import {AttemptsSection} from './card-inspector/sections/AttemptsSection'
import {ActivitySection} from './card-inspector/sections/ActivitySection'
import {useCardInspectorState, type InspectorTab} from './card-inspector/useCardInspectorState'
import type {CardFormValues} from './CardDialogs'
import {AttemptToolbar} from './card-inspector/AttemptToolbar'
import {usePlan} from '@/hooks/plans'
import {usePlanningAttemptState, type PlanningAttemptTab} from './card-inspector/usePlanningAttemptState'

type TopLevelTab = 'ticket' | 'implementation' | 'plan'

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
    const userSetTopLevelTabRef = useRef(false)

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

    const planQuery = usePlan(projectId, card.id)
    const plan = planQuery.data ?? null

    const planningAttempt = usePlanningAttemptState({projectId, cardId: card.id})

    const [activeTopLevelTab, setActiveTopLevelTab] = useState<TopLevelTab>('ticket')
    const [activeImplementationTab, setActiveImplementationTab] = useState<InspectorTab>('messages')
    const [activePlanningTab, setActivePlanningTab] = useState<PlanningAttemptTab>('messages')

    const implementationAttemptForCard =
        attempt.attempt && attempt.attempt.cardId === card.id ? attempt.attempt : null
    const planningAttemptForCard =
        planningAttempt.attempt && planningAttempt.attempt.cardId === card.id ? planningAttempt.attempt : null

    useEffect(() => {
        const cardChanged = previousCardIdRef.current !== card.id
        const desiredTopLevel: TopLevelTab = implementationAttemptForCard
            ? 'implementation'
            : plan || planningAttemptForCard
                ? 'plan'
                : 'ticket'

        if (cardChanged) {
            previousCardIdRef.current = card.id
            userSetTopLevelTabRef.current = false
            setActiveTopLevelTab(desiredTopLevel)
            setActiveImplementationTab('messages')
            setActivePlanningTab('messages')
            return
        }

        if (!userSetTopLevelTabRef.current && activeTopLevelTab !== desiredTopLevel) {
            setActiveTopLevelTab(desiredTopLevel)
        }
    }, [card.id, implementationAttemptForCard?.id, planningAttemptForCard?.id, plan?.id, activeTopLevelTab])

    useEffect(() => {
        const currentAttemptId = implementationAttemptForCard?.id
        if (previousAttemptIdRef.current !== currentAttemptId) {
            setActiveImplementationTab('messages')
            previousAttemptIdRef.current = currentAttemptId
        }
    }, [implementationAttemptForCard?.id])

    const previousPlanningAttemptIdRef = useRef<string | undefined>(undefined)
    useEffect(() => {
        const currentAttemptId = planningAttemptForCard?.id
        if (previousPlanningAttemptIdRef.current !== currentAttemptId) {
            setActivePlanningTab('messages')
            previousPlanningAttemptIdRef.current = currentAttemptId
        }
    }, [planningAttemptForCard?.id])

    return (
        <div className="flex h-full flex-col gap-3">
            <InspectorHeader
                card={card}
                locked={locked}
                blocked={blocked}
                copied={header.copied}
                onCopyTicketKey={header.handleCopyTicketKey}
                plan={plan}
                onClose={onClose}
                actions={
                    implementationAttemptForCard ? (
                        <AttemptToolbar
                            attempt={implementationAttemptForCard}
                            openButtonDisabledReason={git.openButtonDisabledReason}
                            onOpenEditor={git.handleOpenEditor}
                            todoSummary={git.todoSummary}
                            onOpenChanges={() => git.setChangesOpen(true)}
                            onOpenCommit={() => git.setCommitOpen(true)}
                            onOpenPr={() => git.setPrOpen(true)}
                            onOpenMerge={() => git.setMergeOpen(true)}
                        />
                    ) : null
                }
            />
            <Tabs
                value={activeTopLevelTab}
                onValueChange={(value) => {
                    userSetTopLevelTabRef.current = true
                    setActiveTopLevelTab(value as TopLevelTab)
                }}
                className="flex min-h-0 flex-1 flex-col gap-3"
            >
                <TabsList>
                    <TabsTrigger value="ticket">Ticket</TabsTrigger>
                    <TabsTrigger value="implementation">Implementation</TabsTrigger>
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                </TabsList>
                <TabsContent value="ticket" className="flex min-h-0 flex-1 flex-col gap-3">
                    <DetailsSection
                        values={details.values}
                        locked={locked}
                        availableCards={availableCards}
                        cardsIndex={cardsIndex}
                        onChangeValues={(patch) => details.setValues((prev) => ({...prev, ...patch}))}
                        onSave={details.handleSave}
                        onDelete={details.handleDelete}
                        onEnhanceInBackground={
                            onEnhanceCard
                                ? async () => {
                                    // Save latest edits, then start background enhancement.
                                    await details.handleSave()
                                    await onEnhanceCard({
                                        title: details.values.title.trim(),
                                        description: details.values.description.trim(),
                                        dependsOn: details.values.dependsOn,
                                        ticketType: details.values.ticketType ?? null,
                                    })
                                }
                                : undefined
                        }
                        saving={details.saving}
                        deleting={details.deleting}
                    />
                </TabsContent>
                <TabsContent value="implementation" className="flex min-h-0 flex-1 flex-col gap-3">
                    {!implementationAttemptForCard && (
                        <AttemptCreateForm
                            kind="implementation"
                            agents={attempt.agents}
                            agent={attempt.agent}
                            onAgentChange={attempt.handleAgentSelect}
                            availableProfiles={attempt.availableProfiles}
                            profileId={attempt.profileId}
                            onProfileChange={(id) => attempt.handleProfileSelect(id ?? '__default__')}
                            onStart={() => attempt.startAttempt()}
                            locked={locked}
                            blocked={blocked}
                            starting={attempt.starting}
                        />
                    )}
                    {implementationAttemptForCard && (
                        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 p-3">
                            <div className="flex min-h-0 flex-1 flex-col gap-2">
                                <div className="text-xs text-muted-foreground">
                                    Attempt {implementationAttemptForCard.id} — Status: {implementationAttemptForCard.status}
                                </div>
                                <Tabs
                                    value={activeImplementationTab}
                                    onValueChange={(value) => setActiveImplementationTab(value as InspectorTab)}
                                    className="flex min-h-0 flex-1 flex-col"
                                >
                                    <TabsList>
                                        <TabsTrigger value="messages">Messages</TabsTrigger>
                                        <TabsTrigger value="processes">Processes</TabsTrigger>
                                        <TabsTrigger value="logs">Logs</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="messages" className="flex min-h-0 flex-1 flex-col">
                                        <AttemptsSection
                                            attempt={implementationAttemptForCard}
                                            projectId={projectId}
                                            cardId={card.id}
                                            locked={locked}
                                            conversation={attempt.conversation}
                                            plan={plan}
                                            followup={attempt.followup}
                                            onFollowupChange={attempt.setFollowup}
                                            onSendFollowup={attempt.sendFollowup}
                                            sendPending={attempt.sendFollowupPending}
                                            stopping={attempt.stopping}
                                            onStopAttempt={attempt.stopAttempt}
                                            onRetryAttempt={implementationAttemptForCard.status === 'failed' ? attempt.retryAttempt : undefined}
                                            retrying={attempt.retrying}
                                            attemptAgent={attempt.attemptAgent}
                                            profileId={attempt.profileId}
                                            onProfileSelect={attempt.handleProfileSelect}
                                            followupProfiles={attempt.followupProfiles}
                                        />
                                    </TabsContent>
                                    <TabsContent value="processes" className="flex min-h-0 flex-1 flex-col">
                                        <ActivitySection
                                            attempt={implementationAttemptForCard}
                                            agent={attempt.agent}
                                            stopping={attempt.stopping}
                                            onStopAttempt={attempt.stopAttempt}
                                            latestDevAutomation={activity.latestDevAutomation}
                                            devScriptConfigured={activity.devScriptConfigured}
                                            devAutomationPending={activity.devAutomationPending}
                                            onRunDevScript={activity.runDevScript}
                                            onViewLogs={() => setActiveImplementationTab('logs')}
                                        />
                                    </TabsContent>
                                    <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col">
                                        <LogsPane logs={attempt.logs}/>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="plan" className="flex min-h-0 flex-1 flex-col gap-3">
                    {planQuery.isLoading ? (
                        <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                            Loading plan…
                        </div>
                    ) : plan ? (
                        <div className="rounded-lg border border-border/60 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Plan (locked)</div>
                                <div className="text-xs text-muted-foreground">
                                    Updated {new Date(plan.updatedAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="whitespace-pre-wrap text-sm">{plan.planMarkdown}</div>
                        </div>
                    ) : !planningAttemptForCard ? (
                        <AttemptCreateForm
                            kind="planning"
                            agents={planningAttempt.agents}
                            agent={planningAttempt.agent}
                            onAgentChange={planningAttempt.handleAgentSelect}
                            availableProfiles={planningAttempt.availableProfiles}
                            profileId={planningAttempt.profileId}
                            onProfileChange={(id) => planningAttempt.handleProfileSelect(id ?? '__default__')}
                            onStart={planningAttempt.startAttempt}
                            locked={locked}
                            blocked={blocked}
                            starting={planningAttempt.starting}
                        />
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 p-3">
                            <div className="flex min-h-0 flex-1 flex-col gap-2">
                                <div className="text-xs text-muted-foreground">
                                    Planning attempt {planningAttemptForCard.id} — Status: {planningAttemptForCard.status}
                                </div>
                                <Tabs
                                    value={activePlanningTab}
                                    onValueChange={(value) => setActivePlanningTab(value as PlanningAttemptTab)}
                                    className="flex min-h-0 flex-1 flex-col"
                                >
                                    <TabsList>
                                        <TabsTrigger value="messages">Messages</TabsTrigger>
                                        <TabsTrigger value="logs">Logs</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="messages" className="flex min-h-0 flex-1 flex-col">
                                        <AttemptsSection
                                            attempt={planningAttemptForCard}
                                            projectId={projectId}
                                            cardId={card.id}
                                            locked={locked}
                                            conversation={planningAttempt.conversation}
                                            plan={plan}
                                            followup={planningAttempt.followup}
                                            onFollowupChange={planningAttempt.setFollowup}
                                            onSendFollowup={planningAttempt.sendFollowup}
                                            sendPending={planningAttempt.sendFollowupPending}
                                            stopping={planningAttempt.stopping}
                                            onStopAttempt={planningAttempt.stopAttempt}
                                            onRetryAttempt={planningAttemptForCard.status === 'failed' ? planningAttempt.retryAttempt : undefined}
                                            retrying={planningAttempt.retrying}
                                            attemptAgent={planningAttempt.attemptAgent}
                                            profileId={planningAttempt.profileId}
                                            onProfileSelect={planningAttempt.handleProfileSelect}
                                            followupProfiles={planningAttempt.followupProfiles}
                                        />
                                    </TabsContent>
                                    <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col">
                                        <LogsPane logs={planningAttempt.logs}/>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
            <GitSection
                projectId={projectId}
                card={card}
                attempt={implementationAttemptForCard}
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

// MessageRow moved to './card-inspector/MessageRow'
