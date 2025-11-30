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

type TopLevelTab = 'ticket' | 'attempts'

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
    const [activeTopLevelTab, setActiveTopLevelTab] = useState<TopLevelTab>('ticket')
    const [activeAttemptTab, setActiveAttemptTab] = useState<InspectorTab>('messages')
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

    useEffect(() => {
        if (previousCardIdRef.current !== card.id) {
            setActiveTopLevelTab('ticket')
            setActiveAttemptTab('messages')
            previousCardIdRef.current = card.id
        }
    }, [card.id])

    useEffect(() => {
        const currentAttemptId = attempt.attempt?.id
        if (previousAttemptIdRef.current !== currentAttemptId) {
            setActiveAttemptTab('messages')
            previousAttemptIdRef.current = currentAttemptId
        }
    }, [attempt.attempt?.id])

    return (
        <div className="flex h-full flex-col gap-3">
            <InspectorHeader
                card={card}
                locked={locked}
                blocked={blocked}
                copied={header.copied}
                onCopyTicketKey={header.handleCopyTicketKey}
                onClose={onClose}
            />
            <Tabs
                value={activeTopLevelTab}
                onValueChange={(value) => setActiveTopLevelTab(value as TopLevelTab)}
                className="flex min-h-0 flex-1 flex-col gap-3"
            >
                <TabsList>
                    <TabsTrigger value="ticket">Ticket</TabsTrigger>
                    <TabsTrigger value="attempts">Attempts</TabsTrigger>
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
                        gitSection={
                            <GitSection
                                projectId={projectId}
                                card={card}
                                attempt={attempt.attempt}
                                openButtonDisabledReason={git.openButtonDisabledReason}
                                todoSummary={git.todoSummary}
                                onOpenEditor={git.handleOpenEditor}
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
                        }
                    />
                </TabsContent>
                <TabsContent value="attempts" className="flex min-h-0 flex-1 flex-col gap-3">
                    {!attempt.attempt && (
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
                    )}
                    {attempt.attempt && (
                        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 p-3">
                            <div className="flex min-h-0 flex-1 flex-col gap-2">
                                <div className="text-xs text-muted-foreground">
                                    Attempt {attempt.attempt.id} — Status: {attempt.attempt.status}
                                </div>
                                <Tabs
                                    value={activeAttemptTab}
                                    onValueChange={(value) => setActiveAttemptTab(value as InspectorTab)}
                                    className="flex min-h-0 flex-1 flex-col"
                                >
                                    <TabsList>
                                        <TabsTrigger value="messages">Messages</TabsTrigger>
                                        <TabsTrigger value="processes">Processes</TabsTrigger>
                                        <TabsTrigger value="logs">Logs</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="messages" className="flex min-h-0 flex-1 flex-col">
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
                                            attemptAgent={attempt.attemptAgent}
                                            profileId={attempt.profileId}
                                            onProfileSelect={attempt.handleProfileSelect}
                                            followupProfiles={attempt.followupProfiles}
                                        />
                                    </TabsContent>
                                    <TabsContent value="processes" className="flex min-h-0 flex-1 flex-col">
                                        <ActivitySection
                                            attempt={attempt.attempt}
                                            agent={attempt.agent}
                                            stopping={attempt.stopping}
                                            onStopAttempt={attempt.stopAttempt}
                                            latestDevAutomation={activity.latestDevAutomation}
                                            devScriptConfigured={activity.devScriptConfigured}
                                            devAutomationPending={activity.devAutomationPending}
                                            onRunDevScript={activity.runDevScript}
                                            onViewLogs={() => setActiveAttemptTab('logs')}
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
            </Tabs>
        </div>
    )
}

// MessageRow moved to './card-inspector/MessageRow'
