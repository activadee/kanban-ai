import type {ReactNode} from 'react'
import type {MessageImage} from 'shared'
import {Button} from '@/components/ui/button'
import {CardDetailsForm, type DetailsValues} from '../CardDetailsForm'
import {Bot} from 'lucide-react'

export type DetailsSectionProps = {
    values: DetailsValues
    locked?: boolean
    availableCards: { id: string; title: string; ticketKey?: string }[]
    cardsIndex?: Map<string, { id: string; title: string; ticketKey?: string }>
    onChangeValues: (patch: Partial<DetailsValues>) => void
    onSave: () => void
    onDelete: () => void
    saving: boolean
    deleting: boolean
    gitSection?: ReactNode
    onEnhanceInBackground?: () => void
    existingImages?: MessageImage[]
    imagesLoading?: boolean
    pendingImages?: MessageImage[]
    onAddImages?: (files: File[]) => Promise<void>
    onRemoveImage?: (index: number) => void
    canAddMoreImages?: boolean
}

export function DetailsSection({
                                   values,
                                   locked,
                                   availableCards,
                                   cardsIndex,
                                   onChangeValues,
                                   onSave,
                                   onDelete,
                                   saving,
                                   deleting,
                                   gitSection,
                                   onEnhanceInBackground,
                                   existingImages,
                                   imagesLoading,
                                   pendingImages,
                                   onAddImages,
                                   onRemoveImage,
                                   canAddMoreImages,
                               }: DetailsSectionProps) {
    return (
        <>
            <CardDetailsForm
                values={values}
                onChange={onChangeValues}
                locked={locked}
                availableCards={availableCards}
                cardsIndex={cardsIndex}
                existingImages={existingImages}
                imagesLoading={imagesLoading}
                pendingImages={pendingImages}
                onAddImages={onAddImages}
                onRemoveImage={onRemoveImage}
                canAddMoreImages={canAddMoreImages}
            />
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={locked || !values.title.trim() || saving}
                >
                    {saving ? 'Saving…' : 'Save'}
                </Button>
                {onEnhanceInBackground ? (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onEnhanceInBackground}
                        disabled={locked || !values.title.trim() || saving}
                    >
                        <Bot className="mr-1 size-4"/> Enhance in background
                    </Button>
                ) : null}
                <Button
                    size="sm"
                    variant="destructive"
                    onClick={onDelete}
                    disabled={deleting || saving}
                >
                    Delete
                </Button>
                <div className="ml-auto">
                    {gitSection}
                </div>
            </div>
        </>
    )
}
