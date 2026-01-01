import type {CSSProperties} from 'react'
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import type {Card as TCard} from 'shared'
import type {AttemptStatus} from 'shared'
import {KanbanCard} from './Card'
import type {CardEnhancementStatus} from '@/hooks/tickets'
import type {CardLane} from './cardLane'

type Props = {
    card: TCard
    columnId: string
    projectId: string
    lane: CardLane
    isDone?: boolean
    showAgentComingSoon?: boolean
    blocked?: boolean
    blockers?: string[]
    selected?: boolean
    onSelect?: (cardId: string) => void
    enhancementStatus?: CardEnhancementStatus
    attemptStatus?: AttemptStatus
    onCardEnhancementClick?: (cardId: string) => void
    onEdit?: (cardId: string) => void
    onEnhance?: (cardId: string) => void
}

export function DraggableCard({
                                  card,
                                  columnId,
                                  projectId,
                                  lane,
                                  isDone,
                                  showAgentComingSoon,
                                  blocked,
                                  blockers,
                                  selected,
                                  onSelect,
                                  enhancementStatus,
                                  attemptStatus,
                                  onCardEnhancementClick,
                                  onEdit,
                                  onEnhance,
                              }: Props) {
    const isEnhancing = enhancementStatus === 'enhancing'
    const isFailed = attemptStatus === 'failed'
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
        disabled: isEnhancing || isFailed,
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
            {...(!(isEnhancing || isFailed) ? listeners : undefined)}
            onClick={(e) => {
                // Allow clicking to select even when failed, so users can open and edit/retry
                if (isEnhancing) return
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
                selected={selected}
                enhancementStatus={enhancementStatus}
                attemptStatus={attemptStatus}
                onEnhancementClick={
                    enhancementStatus === 'ready' && onCardEnhancementClick
                        ? () => onCardEnhancementClick(card.id)
                        : undefined
                }
                disabled={isEnhancing}
                menuContext={{
                    projectId,
                    lane,
                    blocked: Boolean(blocked),
                    onOpenDetails: onSelect ? () => onSelect(card.id) : undefined,
                    onEdit: onEdit ? () => onEdit(card.id) : undefined,
                    onEnhanceTicket: onEnhance ? () => onEnhance(card.id) : undefined,
                }}
            />
        </div>
    )
}
