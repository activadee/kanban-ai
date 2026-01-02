import {useEffect, useRef, useState} from 'react'
import type {AgentKey, Attempt, ConversationItem, MessageImage} from 'shared'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {ImageAttachment} from '@/components/ui/image-attachment'
import {cn} from '@/lib/utils'
import {MessageRow} from '../MessageRow'

function AgentTypingIndicator() {
    return (
        <div className="agent-typing-indicator mb-3 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
                <div className="agent-typing-core" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-4 py-2.5">
                <div className="agent-typing-orbs">
                    <span className="agent-typing-orb" />
                    <span className="agent-typing-orb" />
                    <span className="agent-typing-orb" />
                </div>
                <span className="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    working
                </span>
            </div>
        </div>
    )
}

export type AttemptsSectionProps = {
    attempt: Attempt
    cardId: string
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
    pendingImages: MessageImage[]
    addImages: (files: File[]) => Promise<void>
    removeImage: (index: number) => void
    canAddMoreImages: boolean
}



export function AttemptsSection({
                                    attempt,
                                    cardId,
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
                                    pendingImages,
                                    addImages,
                                    removeImage,
                                    canAddMoreImages,
                                }: AttemptsSectionProps) {
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const initialScrolledForCardRef = useRef<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        if (!conversation.length) return
        if (initialScrolledForCardRef.current === cardId) return
        initialScrolledForCardRef.current = cardId
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({behavior: 'auto', block: 'end'})
        })
    }, [conversation.length, cardId])

    const handlePaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files.length > 0) {
            e.preventDefault()
            addImages(Array.from(e.clipboardData.files))
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!canAddMoreImages) return
        if (!isDragging) setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        if (e.dataTransfer.files.length > 0) {
            addImages(Array.from(e.dataTransfer.files))
        }
    }

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
                            agentKey={attemptAgent}
                            profiles={followupProfiles}
                        />
                    ))
                )}
                {attempt.status === 'running' && <AgentTypingIndicator />}
                <div ref={messagesEndRef}/>
            </div>
            {!locked && attempt.sessionId ? (
                <div className="mt-2 space-y-2">
                    <div
                        className={cn(
                            'space-y-1 rounded border border-transparent p-1 transition-colors',
                            isDragging && 'border-primary/50 bg-primary/5'
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Label htmlFor="ins-follow">Follow-up</Label>
                        <Textarea
                            id="ins-follow"
                            rows={3}
                            value={followup}
                            onChange={(event) => onFollowupChange(event.target.value)}
                            onPaste={handlePaste}
                            placeholder={isDragging ? 'Drop images here…' : 'Ask the agent to continue… (Paste images supported)'}
                            className={cn(isDragging && 'pointer-events-none')}
                        />
                        {pendingImages.length > 0 && (
                            <ImageAttachment 
                                images={pendingImages} 
                                variant="thumbnail" 
                                size="sm"
                                onRemove={removeImage}
                                className="py-2"
                            />
                        )}
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
                                disabled={sendPending || (!followup.trim() && pendingImages.length === 0)}
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

