import type {ReactNode} from 'react'
import {Button} from '@/components/ui/button'
import {CardDetailsForm, type DetailsValues} from '../CardDetailsForm'

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
                               }: DetailsSectionProps) {
    return (
        <>
            <CardDetailsForm
                values={values}
                onChange={onChangeValues}
                locked={locked}
                availableCards={availableCards}
                cardsIndex={cardsIndex}
            />
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={locked || !values.title.trim() || saving}
                >
                    {saving ? 'Saving…' : 'Save'}
                </Button>
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

