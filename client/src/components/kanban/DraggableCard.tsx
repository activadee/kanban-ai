import type {CSSProperties} from 'react'
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import type {Card as TCard} from 'shared'
import {KanbanCard} from './Card'

type Props = {
    card: TCard
    columnId: string
    isDone?: boolean
    showAgentComingSoon?: boolean
    blocked?: boolean
    blockers?: string[]
    onSelect?: (cardId: string) => void
}

export function DraggableCard({card, columnId, isDone, showAgentComingSoon, blocked, blockers, onSelect}: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: card.id, data: {type: 'card', cardId: card.id, columnId}})

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                e.stopPropagation()
                onSelect?.(card.id)
            }}
            className="select-none"
        >
            <KanbanCard card={card} done={isDone} showAgentComingSoon={showAgentComingSoon} blocked={blocked}
                        blockers={blockers}/>
        </div>
    )
}
