import {useEffect, useRef, useState} from 'react'
import type {AgentKey, Attempt, CardPlan, ConversationItem} from 'shared'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {MessageRow} from '../MessageRow'
import {useSavePlan} from '@/hooks/plans'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'

export type AttemptsSectionProps = {
    attempt: Attempt
    projectId: string
    cardId: string
    plan?: CardPlan | null
    locked?: boolean
    conversation: ConversationItem[]
    followup: string
    onFollowupChange: (value: string) => void
    onSendFollowup: () => void
    sendPending: boolean
    stopping: boolean
    onStopAttempt: () => void
    onRetryAttempt?: () => void
    retrying?: boolean
    attemptAgent?: AgentKey
    profileId?: string
    onProfileSelect: (value: string) => void
    followupProfiles: Array<{ id: string; name: string }>
}

export function AttemptsSection({
                                    attempt,
                                    projectId,
                                    cardId,
                                    plan,
                                    locked,
                                    conversation,
                                    followup,
                                    onFollowupChange,
                                    onSendFollowup,
                                    sendPending,
                                    stopping,
                                    onStopAttempt,
                                    onRetryAttempt,
                                    retrying,
                                    attemptAgent,
                                    profileId,
                                    onProfileSelect,
                                    followupProfiles,
                                }: AttemptsSectionProps) {
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const initialScrolledForCardRef = useRef<string | null>(null)
    const [savingPlanMessageId, setSavingPlanMessageId] = useState<string | null>(null)

    const savePlanMutation = useSavePlan({
        onSuccess: () => {
            toast({title: 'Plan saved', variant: 'success'})
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Save plan failed')
            toast({title, description, variant: 'destructive'})
        },
    })

    const handleMarkAsPlan = async (item: ConversationItem) => {
        if (attempt.isPlanningAttempt !== true) return
        if (item.type !== 'message' || item.role !== 'assistant') return
        const markdown = item.text.trim()
        if (!markdown) return

        setSavingPlanMessageId(item.id ?? '')
        try {
            await savePlanMutation.mutateAsync({
                projectId,
                cardId,
                input: {
                    planMarkdown: markdown,
                    sourceMessageId: item.id,
                    sourceAttemptId: attempt.id,
                },
            })
        } finally {
            setSavingPlanMessageId(null)
        }
    }

    useEffect(() => {
        if (!conversation.length) return
        if (initialScrolledForCardRef.current === cardId) return
        initialScrolledForCardRef.current = cardId
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({behavior: 'auto', block: 'end'})
        })
    }, [conversation.length, cardId])

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-auto rounded bg-muted/10 p-2 text-sm"
            >
                {conversation.length === 0 ? (
                    <div className="text-muted-foreground">No messages yet…</div>
                ) : (
                    conversation.map((item, index) => (
                        <MessageRow
                            key={item.id ?? `${item.timestamp}-${index}`}
                            item={item}
                            isSavedPlan={Boolean(plan?.sourceMessageId && item.id && plan.sourceMessageId === item.id)}
                            markAsPlanPending={Boolean(savingPlanMessageId && savingPlanMessageId === item.id)}
                            onMarkAsPlan={
                                attempt.isPlanningAttempt === true && item.type === 'message' && item.role === 'assistant'
                                    ? () => handleMarkAsPlan(item)
                                    : undefined
                            }
                        />
                    ))
                )}
                <div ref={messagesEndRef}/>
            </div>
            {!locked && attempt.sessionId ? (
                <div className="mt-2 space-y-2">
                    <div className="space-y-1">
                        <Label htmlFor="ins-follow">Follow-up</Label>
                        <Textarea
                            id="ins-follow"
                            rows={3}
                            value={followup}
                            onChange={(event) => onFollowupChange(event.target.value)}
                            placeholder="Ask the agent to continue…"
                        />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        {attemptAgent ? (
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Profile</Label>
                                <Select
                                    value={profileId ?? '__default__'}
                                    onValueChange={onProfileSelect}
                                >
                                    <SelectTrigger className="h-8 w-44">
                                        <SelectValue placeholder="DEFAULT"/>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 overflow-y-auto text-xs">
                                        <SelectItem value="__default__">DEFAULT</SelectItem>
                                        {followupProfiles.map((profile) => (
                                            <SelectItem key={profile.id} value={profile.id}>
                                                {profile.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <span/>
                        )}
                        <div className="flex items-center gap-2">
                            {attempt.status === 'running' || attempt.status === 'stopping' ? (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={onStopAttempt}
                                    disabled={stopping || attempt.status === 'stopping'}
                                >
                                    {stopping || attempt.status === 'stopping' ? 'Stopping…' : 'Stop'}
                                </Button>
                            ) : null}
                            {attempt.status === 'failed' && onRetryAttempt ? (
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={onRetryAttempt}
                                    disabled={retrying}
                                >
                                    {retrying ? 'Retrying…' : 'Retry'}
                                </Button>
                            ) : null}
                            <Button
                                size="sm"
                                onClick={onSendFollowup}
                                disabled={sendPending || !followup.trim()}
                            >
                                {sendPending ? 'Sending…' : 'Send'}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
