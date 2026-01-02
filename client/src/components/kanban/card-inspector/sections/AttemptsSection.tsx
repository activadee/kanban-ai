import {useState} from 'react'
import type {AgentKey, Attempt, ConversationItem, MessageImage} from 'shared'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {ImageAttachment} from '@/components/ui/image-attachment'
import {cn} from '@/lib/utils'
import {MessageRow, type StreamdownSettings} from '../MessageRow'
import {useAutoScroll, useAutoScrollEffect} from '@/hooks/useAutoScroll'
import {Send, Square, RotateCcw, Bot, Sparkles, ArrowDownToLine} from 'lucide-react'

function AgentTypingIndicator() {
    return (
        <div className="agent-typing-indicator mb-3 flex items-center gap-2.5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                <div className="agent-typing-core" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-4 py-2.5 border border-amber-500/20">
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

function AttemptStatusBadge({status}: {status: Attempt['status']}) {
    const statusStyles: Record<Attempt['status'], {bg: string; text: string; label: string}> = {
        queued: {bg: 'bg-muted', text: 'text-muted-foreground', label: 'Queued'},
        running: {bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', label: 'Running'},
        stopping: {bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', label: 'Stopping'},
        succeeded: {bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', label: 'Completed'},
        failed: {bg: 'bg-destructive/15', text: 'text-destructive', label: 'Failed'},
        stopped: {bg: 'bg-muted', text: 'text-muted-foreground', label: 'Stopped'},
    }
    
    const style = statusStyles[status] || statusStyles.queued
    
    return (
        <Badge variant="outline" className={cn('text-[10px] font-medium', style.bg, style.text)}>
            {status === 'running' && <Sparkles className="h-2.5 w-2.5 mr-1 animate-pulse" />}
            {style.label}
        </Badge>
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
    streamdownSettings?: StreamdownSettings
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
    streamdownSettings,
}: AttemptsSectionProps) {
    const [isDragging, setIsDragging] = useState(false)

    const autoScroll = useAutoScroll({
        storageKey: 'kanbanai:attempts-autoscroll-enabled',
        defaultEnabled: true,
        bottomThreshold: 80,
    })

    useAutoScrollEffect(
        autoScroll.isEnabled,
        autoScroll.scrollToBottom,
        `${cardId}:${conversation.length}`,
    )

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (!sendPending && (followup.trim() || pendingImages.length > 0)) {
                onSendFollowup()
            }
        }
    }

    const canSend = !sendPending && (followup.trim() || pendingImages.length > 0)
    const showFollowupInput = !locked && attempt.sessionId

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                    <span className="font-medium">{attempt.agent || 'Agent'}</span>
                </div>
                <AttemptStatusBadge status={attempt.status} />
                <div className="flex items-center gap-2 ml-auto">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={autoScroll.toggle}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                                        autoScroll.isEnabled
                                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                    aria-label={autoScroll.isEnabled ? "Disable auto-scroll" : "Enable auto-scroll"}
                                    aria-pressed={autoScroll.isEnabled}
                                    data-testid="autoscroll-toggle"
                                >
                                    <ArrowDownToLine className="h-3 w-3" />
                                    <span data-testid="autoscroll-status">
                                        {autoScroll.isEnabled ? "AUTO" : "OFF"}
                                    </span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                                {autoScroll.isEnabled ? "Auto-scroll enabled (click to disable)" : "Auto-scroll disabled (click to enable)"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <span className="text-[10px] text-muted-foreground font-mono">
                        {attempt.id.slice(0, 8)}
                    </span>
                </div>
            </div>

            <div
                ref={autoScroll.containerRef}
                onScroll={autoScroll.handleScroll}
                className="flex-1 min-h-0 overflow-auto p-3 scroll-smooth"
            >
                {conversation.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                            <Bot className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {attempt.status === 'queued' 
                                ? 'Agent is starting up...' 
                                : 'Waiting for messages...'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {conversation.map((item, index) => (
                            <MessageRow
                                key={item.id ?? `${item.timestamp}-${index}`}
                                item={item}
                                agentKey={attemptAgent}
                                profiles={followupProfiles}
                                streamdownSettings={streamdownSettings}
                            />
                        ))}
                    </div>
                )}
                {attempt.status === 'running' && <AgentTypingIndicator />}
                <div ref={autoScroll.targetRef} />
            </div>

            {showFollowupInput && (
                <div className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-sm p-3">
                    <div
                        className={cn(
                            'rounded-xl border transition-all duration-200',
                            isDragging 
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                                : 'border-border/60 bg-muted/30',
                            'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10'
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Textarea
                            value={followup}
                            onChange={(e) => onFollowupChange(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={handleKeyDown}
                            placeholder={isDragging ? 'Drop images here...' : 'Send a follow-up message... (⌘+Enter to send)'}
                            className={cn(
                                'min-h-[60px] max-h-[120px] resize-none border-0 bg-transparent px-3 py-2.5',
                                'focus-visible:ring-0 focus-visible:ring-offset-0',
                                'placeholder:text-muted-foreground/50',
                                isDragging && 'pointer-events-none'
                            )}
                            rows={2}
                        />
                        
                        {pendingImages.length > 0 && (
                            <div className="px-3 pb-2">
                                <ImageAttachment
                                    images={pendingImages}
                                    variant="thumbnail"
                                    size="sm"
                                    onRemove={removeImage}
                                />
                            </div>
                        )}
                        
                        <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
                            <div className="flex items-center gap-2">
                                {attemptAgent && followupProfiles.length > 0 && (
                                    <Select
                                        value={profileId ?? '__default__'}
                                        onValueChange={onProfileSelect}
                                    >
                                        <SelectTrigger className="h-7 w-32 text-xs border-0 bg-muted/50">
                                            <SelectValue placeholder="Profile" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 overflow-y-auto text-xs">
                                            <SelectItem value="__default__">Default</SelectItem>
                                            {followupProfiles.map((profile) => (
                                                <SelectItem key={profile.id} value={profile.id}>
                                                    {profile.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                                {(attempt.status === 'running' || attempt.status === 'stopping') && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={onStopAttempt}
                                        disabled={stopping || attempt.status === 'stopping'}
                                        className="h-7 gap-1.5 text-xs"
                                    >
                                        <Square className="h-3 w-3" />
                                        {stopping || attempt.status === 'stopping' ? 'Stopping...' : 'Stop'}
                                    </Button>
                                )}
                                
                                {attempt.status === 'failed' && onRetryAttempt && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={onRetryAttempt}
                                        disabled={retrying}
                                        className="h-7 gap-1.5 text-xs"
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        {retrying ? 'Retrying...' : 'Retry'}
                                    </Button>
                                )}
                                
                                <Button
                                    size="sm"
                                    onClick={onSendFollowup}
                                    disabled={!canSend}
                                    className={cn(
                                        "h-7 gap-1.5 text-xs transition-all",
                                        canSend && "shadow-sm"
                                    )}
                                >
                                    <Send className="h-3 w-3" />
                                    {sendPending ? 'Sending...' : 'Send'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
