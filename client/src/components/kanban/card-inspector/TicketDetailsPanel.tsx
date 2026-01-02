import type {MessageImage, TicketType} from 'shared'
import {Loader2, Bot, Trash2, Save} from 'lucide-react'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {DependenciesPicker} from '@/components/kanban/DependenciesPicker'
import {ImageAttachment} from '@/components/ui/image-attachment'
import {formatTicketType, ticketTypeOptions, getTicketTypeColor} from '@/lib/ticketTypes'
import {cn} from '@/lib/utils'

export type TicketDetailsValues = {
    title: string
    description: string
    dependsOn: string[]
    ticketType: TicketType | null
}

export type TicketDetailsPanelProps = {
    values: TicketDetailsValues
    locked?: boolean
    availableCards: { id: string; title: string; ticketKey?: string }[]
    cardsIndex?: Map<string, { id: string; title: string; ticketKey?: string }>
    onChangeValues: (patch: Partial<TicketDetailsValues>) => void
    onSave: () => void
    onDelete: () => void
    saving: boolean
    deleting: boolean
    existingImages?: MessageImage[]
    imagesLoading?: boolean
    pendingImages?: MessageImage[]
    onAddImages?: (files: File[]) => Promise<void>
    onRemoveImage?: (index: number) => void
    canAddMoreImages?: boolean
    onEnhanceInBackground?: () => void
}

export function TicketDetailsPanel({
    values,
    locked,
    availableCards,
    cardsIndex,
    onChangeValues,
    onSave,
    onDelete,
    saving,
    deleting,
    existingImages,
    imagesLoading,
    pendingImages,
    onAddImages,
    onRemoveImage,
    canAddMoreImages,
    onEnhanceInBackground,
}: TicketDetailsPanelProps) {
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

    const typeColor = getTicketTypeColor(values.ticketType)

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="ticket-title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Title
                </Label>
                <Input
                    id="ticket-title"
                    value={values.title}
                    onChange={(e) => onChangeValues({title: e.target.value})}
                    disabled={locked}
                    className="text-base font-medium"
                    placeholder="What needs to be done?"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="ticket-desc" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description
                </Label>
                <Textarea
                    id="ticket-desc"
                    rows={5}
                    value={values.description}
                    onChange={(e) => onChangeValues({description: e.target.value})}
                    disabled={locked}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder={canAddMoreImages ? "Describe the task... (paste or drop images here)" : "Describe the task..."}
                    className="resize-none leading-relaxed"
                />
                {imagesLoading && (
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Loading images...</span>
                    </div>
                )}
                {existingImages && existingImages.length > 0 && !imagesLoading && (
                    <div className="mt-3 space-y-1">
                        <ImageAttachment images={existingImages} variant="thumbnail" size="sm" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{existingImages.length} saved</p>
                    </div>
                )}
                {pendingImages && pendingImages.length > 0 && (
                    <div className="mt-3 space-y-1">
                        <ImageAttachment
                            images={pendingImages}
                            variant="thumbnail"
                            size="sm"
                            onRemove={onRemoveImage}
                        />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {pendingImages.length} new (will be saved with ticket)
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="ticket-type" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Type
                    </Label>
                    <Select
                        value={(values.ticketType ?? 'none') as string}
                        onValueChange={(next) =>
                            onChangeValues({ticketType: next === 'none' ? null : (next as TicketType)})
                        }
                        disabled={locked}
                    >
                        <SelectTrigger
                            id="ticket-type"
                            className="w-full"
                            style={{
                                borderLeftWidth: '3px',
                                borderLeftColor: typeColor || 'transparent',
                            }}
                        >
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
                    <p className="text-[10px] text-muted-foreground">{formatTicketType(values.ticketType)}</p>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Dependencies
                    </Label>
                    <div className="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] rounded-md border border-input bg-background px-2 py-1.5">
                        {(values.dependsOn ?? []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                            (values.dependsOn ?? []).slice(0, 3).map((id) => {
                                const cardMeta = cardsIndex?.get(id) || availableCards.find((c) => c.id === id)
                                const label = cardMeta?.ticketKey || id.slice(0, 6)
                                return (
                                    <Badge key={id} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {label}
                                    </Badge>
                                )
                            })
                        )}
                        {(values.dependsOn ?? []).length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                +{(values.dependsOn ?? []).length - 3}
                            </Badge>
                        )}
                    </div>
                    <DependenciesPicker
                        availableCards={availableCards}
                        value={values.dependsOn ?? []}
                        onChange={(ids) => onChangeValues({dependsOn: ids})}
                        triggerLabel="Edit"
                        hint="Only tickets not in Done are listed."
                        disabled={locked}
                        widthClass="max-h-72 w-96"
                    />
                </div>
            </div>

            <div className={cn(
                "flex items-center gap-2 pt-4 border-t border-border/30",
                "animate-in fade-in-50 slide-in-from-bottom-2 duration-200"
            )}>
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={locked || !values.title.trim() || saving}
                    className="gap-1.5"
                >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                </Button>
                {onEnhanceInBackground && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onEnhanceInBackground}
                        disabled={locked || !values.title.trim() || saving}
                        className="gap-1.5"
                    >
                        <Bot className="h-3.5 w-3.5" />
                        Enhance
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDelete}
                    disabled={deleting || saving}
                    className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                </Button>
            </div>
        </div>
    )
}
