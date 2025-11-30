import type {CSSProperties} from 'react'
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import type {Card as TCard} from 'shared'
import {KanbanCard} from './Card'
import type {CardEnhancementStatus} from '@/hooks/tickets'

type Props = {
    card: TCard
    columnId: string
    isDone?: boolean
    showAgentComingSoon?: boolean
    blocked?: boolean
    blockers?: string[]
    onSelect?: (cardId: string) => void
    enhancementStatus?: CardEnhancementStatus
    onCardEnhancementClick?: (cardId: string) => void
}

export function DraggableCard({
                                  card,
                                  columnId,
                                  isDone,
                                  showAgentComingSoon,
                                  blocked,
                                  blockers,
                                  onSelect,
                                  enhancementStatus,
                                  onCardEnhancementClick,
                              }: Props) {
    const isEnhancing = enhancementStatus === 'enhancing'
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: card.id,
        data: {type: 'card', cardId: card.id, columnId},
        disabled: isEnhancing,
    })

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
            {...(!isEnhancing ? listeners : undefined)}
            onClick={(e) => {
                e.stopPropagation()
                onSelect?.(card.id)
            }}
            className={`select-none ${isEnhancing ? 'cursor-not-allowed opacity-70' : ''}`}
        >
            <KanbanCard
                card={card}
                done={isDone}
                showAgentComingSoon={showAgentComingSoon}
                blocked={blocked}
                blockers={blockers}
                enhancementStatus={enhancementStatus}
                onEnhancementClick={
                    enhancementStatus === 'ready' && onCardEnhancementClick
                        ? () => onCardEnhancementClick(card.id)
                        : undefined
                }
                disabled={isEnhancing}
            />
        </div>
    )
}
