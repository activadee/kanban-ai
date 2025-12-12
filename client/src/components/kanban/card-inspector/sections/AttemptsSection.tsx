import {useEffect, useRef, useState, type ClipboardEvent, type DragEvent} from 'react'
import {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_BYTES,
    MAX_IMAGES_PER_MESSAGE,
    type AgentKey,
    type Attempt,
    type ConversationItem,
    type ImageAttachment,
} from 'shared'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {toast} from '@/components/ui/toast'
import {X} from 'lucide-react'
import {MessageRow} from '../MessageRow'

export type AttemptsSectionProps = {
    attempt: Attempt
    cardId: string
    locked?: boolean
    conversation: ConversationItem[]
    followup: string
    onFollowupChange: (value: string) => void
    followupImages: ImageAttachment[]
    onFollowupImagesChange: (images: ImageAttachment[]) => void
    onSendFollowup: () => void
    sendPending: boolean
    stopping: boolean
    onStopAttempt: () => void
    attemptAgent?: AgentKey
    profileId?: string
    onProfileSelect: (value: string) => void
    followupProfiles: Array<{ id: string; name: string }>
}

export function AttemptsSection({
                                    attempt,
                                    cardId,
                                    locked,
                                    conversation,
                                    followup,
                                    onFollowupChange,
                                    followupImages,
                                    onFollowupImagesChange,
                                    onSendFollowup,
                                    sendPending,
                                    stopping,
                                    onStopAttempt,
                                    attemptAgent,
                                    profileId,
                                    onProfileSelect,
                                    followupProfiles,
                                }: AttemptsSectionProps) {
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const initialScrolledForCardRef = useRef<string | null>(null)
    const [dragActive, setDragActive] = useState(false)

    const readFileDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })

    const addImageFiles = async (files: File[]) => {
        if (!files.length) return
        const remaining = MAX_IMAGES_PER_MESSAGE - followupImages.length
        if (remaining <= 0) {
            toast({
                title: 'Image limit reached',
                description: `You can attach up to ${MAX_IMAGES_PER_MESSAGE} images.`,
                variant: 'destructive',
            })
            return
        }
        const nextFiles = files.slice(0, remaining)
        const newAttachments: ImageAttachment[] = []
        for (const file of nextFiles) {
            const mimeType = file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
            if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
                toast({
                    title: 'Unsupported image format',
                    description: 'Only PNG, JPEG, and WebP are supported.',
                    variant: 'destructive',
                })
                continue
            }
            if (file.size > MAX_IMAGE_BYTES) {
                toast({
                    title: 'Image too large',
                    description: `Images must be under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`,
                    variant: 'destructive',
                })
                continue
            }
            try {
                const dataUrl = await readFileDataUrl(file)
                newAttachments.push({
                    id: `img-${crypto.randomUUID()}`,
                    mimeType,
                    dataUrl,
                    sizeBytes: file.size,
                    name: file.name,
                })
            } catch (err) {
                console.warn('Failed reading image', err)
            }
        }
        if (newAttachments.length) {
            onFollowupImagesChange([...followupImages, ...newAttachments])
        }
    }

    const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = Array.from(event.clipboardData.items ?? [])
        const files = items
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter(Boolean) as File[]
        if (files.length) {
            void addImageFiles(files)
        }
    }

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDragActive(true)
    }

    const handleDragLeave = () => {
        setDragActive(false)
    }

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        setDragActive(false)
        const files = Array.from(event.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length) void addImageFiles(files)
    }

    const removeImage = (id?: string) => {
        if (!id) return
        onFollowupImagesChange(followupImages.filter((img) => img.id !== id))
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
                        <MessageRow key={item.id ?? `${item.timestamp}-${index}`} item={item}/>
                    ))
                )}
                <div ref={messagesEndRef}/>
            </div>
            {!locked && attempt.sessionId ? (
                <div className="mt-2 space-y-2">
                    <div className="space-y-1">
                        <Label htmlFor="ins-follow">Follow-up</Label>
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={dragActive ? 'rounded-md ring-2 ring-ring/50' : undefined}
                        >
                            <Textarea
                                id="ins-follow"
                                rows={3}
                                value={followup}
                                onChange={(event) => onFollowupChange(event.target.value)}
                                onPaste={handlePaste}
                                placeholder="Ask the agent to continue… (paste or drop images)"
                            />
                        </div>
                        {followupImages.length > 0 ? (
                            <div className="mt-2 space-y-1">
                                <div className="text-xs text-muted-foreground">
                                    Attached images ({followupImages.length})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {followupImages.map((img) => (
                                        <div key={img.id ?? img.dataUrl} className="relative">
                                            <img
                                                src={img.dataUrl}
                                                alt={img.name ?? 'attachment'}
                                                className="h-20 w-20 rounded border object-cover"
                                            />
                                            {img.id ? (
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="secondary"
                                                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                                                    onClick={() => removeImage(img.id)}
                                                >
                                                    <X className="h-3 w-3"/>
                                                </Button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
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
                            <Button
                                size="sm"
                                onClick={onSendFollowup}
                                disabled={sendPending || (!followup.trim() && followupImages.length === 0)}
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
