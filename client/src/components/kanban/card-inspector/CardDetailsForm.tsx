import {Loader2} from 'lucide-react'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Badge} from '@/components/ui/badge'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {DependenciesPicker} from '@/components/kanban/DependenciesPicker'
import {ImageAttachment} from '@/components/ui/image-attachment'
import type {TicketType, MessageImage} from 'shared'
import {formatTicketType, ticketTypeOptions} from '@/lib/ticketTypes'

export type DetailsValues = { title: string; description: string; dependsOn: string[]; ticketType: TicketType | null }

export function CardDetailsForm({
                                    values,
                                    onChange,
                                    locked,
                                    availableCards,
                                    cardsIndex,
                                    existingImages,
                                    imagesLoading,
                                    pendingImages,
                                    onAddImages,
                                    onRemoveImage,
                                    canAddMoreImages,
                                }: {
    values: DetailsValues
    onChange: (patch: Partial<DetailsValues>) => void
    locked?: boolean
    availableCards: { id: string; title: string; ticketKey?: string }[]
    cardsIndex?: Map<string, { id: string; title: string; ticketKey?: string }>
    existingImages?: MessageImage[]
    imagesLoading?: boolean
    pendingImages?: MessageImage[]
    onAddImages?: (files: File[]) => Promise<void>
    onRemoveImage?: (index: number) => void
    canAddMoreImages?: boolean
}) {
    const handlePaste = async (e: React.ClipboardEvent) => {
        if (!onAddImages) return
        const items = e.clipboardData?.items
        if (!items) return
        const files: File[] = []
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) files.push(file)
            }
        }
        if (files.length > 0) {
            e.preventDefault()
            await onAddImages(files)
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        if (!onAddImages) return
        e.preventDefault()
        const files: File[] = []
        for (const item of e.dataTransfer.files) {
            if (item.type.startsWith('image/')) {
                files.push(item)
            }
        }
        if (files.length > 0) {
            await onAddImages(files)
        }
    }
    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="ins-title">Title</Label>
                <Input id="ins-title" value={values.title} onChange={(e) => onChange({title: e.target.value})}
                       disabled={locked}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="ins-desc">Description</Label>
                <Textarea 
                    id="ins-desc" 
                    rows={4} 
                    value={values.description}
                    onChange={(e) => onChange({description: e.target.value})} 
                    disabled={locked}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder={canAddMoreImages ? "Describe the task... (paste or drop images here)" : "Describe the task..."}
                />
                {imagesLoading && (
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Loading images...</span>
                    </div>
                )}
                {existingImages && existingImages.length > 0 && !imagesLoading && (
                    <div className="mt-2 space-y-1">
                        <ImageAttachment images={existingImages} variant="thumbnail" size="sm" />
                        <p className="text-xs text-muted-foreground">{existingImages.length} saved</p>
                    </div>
                )}
                {pendingImages && pendingImages.length > 0 && (
                    <div className="mt-2 space-y-1">
                        <ImageAttachment 
                            images={pendingImages} 
                            variant="thumbnail" 
                            size="sm"
                            onRemove={onRemoveImage}
                        />
                        <p className="text-xs text-muted-foreground">
                            {pendingImages.length} new (will be saved with ticket)
                        </p>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <Label htmlFor="ins-type">Type</Label>
                <Select
                    value={(values.ticketType ?? 'none') as string}
                    onValueChange={(next) =>
                        onChange({ticketType: next === 'none' ? null : (next as TicketType)})
                    }
                    disabled={locked}
                >
                    <SelectTrigger id="ins-type" className="w-full">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="none">None</SelectItem>
                        {ticketTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{formatTicketType(values.ticketType)}</p>
            </div>
            <div className="space-y-2">
                <Label>Dependencies</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {(values.dependsOn ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                    ) : (
                        (values.dependsOn ?? []).map((id) => {
                            const cardMeta = cardsIndex?.get(id) || availableCards.find((c) => c.id === id)
                            const label = cardMeta ? `${cardMeta.ticketKey ? `[${cardMeta.ticketKey}] ` : ''}${cardMeta.title}` : id
                            return (
                                <Badge key={id} variant="outline" className="text-xs">{label}</Badge>
                            )
                        })
                    )}
                </div>
                <DependenciesPicker
                    availableCards={availableCards}
                    value={values.dependsOn ?? []}
                    onChange={(ids) => onChange({dependsOn: ids})}
                    triggerLabel="Edit dependencies"
                    hint="Only tickets not in Done are listed."
                    disabled={locked}
                    widthClass="max-h-72 w-96"
                />
            </div>
        </>
    )
}
