import {useMemo} from 'react'
import {Card as UICard, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import type {BoardState, Column as TColumn} from 'shared'
import {useDroppable} from '@dnd-kit/core'
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {DraggableCard} from './DraggableCard'
import type {CardEnhancementStatus} from '@/hooks/tickets'
import type {CardLane} from './cardLane'

type Props = {
    column: TColumn
    state: BoardState
    onSelectCard: (cardId: string) => void
    enhancementStatusByCardId?: Record<string, CardEnhancementStatus>
    onCardEnhancementClick?: (cardId: string) => void
    onEditCard: (cardId: string) => void
    onEnhanceCard: (cardId: string) => void
    projectId: string
    isCardBlocked: (cardId: string) => boolean
}

export function Column({
                           column,
                           state,
                           onSelectCard,
                           enhancementStatusByCardId,
                           onCardEnhancementClick,
                           onEditCard,
                           onEnhanceCard,
                           projectId,
                           isCardBlocked,
                       }: Props) {
    const cards = useMemo(
        () => column.cardIds.map((id) => state.cards[id]).filter(Boolean),
        [column.cardIds, state.cards]
    )
    const {setNodeRef, isOver} = useDroppable({id: column.id, data: {type: 'column', columnId: column.id}})

    const normalizedTitle = column.title.trim().toLowerCase()
    const isBacklogColumn = column.key === 'backlog' || normalizedTitle === 'backlog'
    const isInProgressColumn = column.key === 'inProgress' || normalizedTitle === 'in progress'
    const isReviewColumn = column.key === 'review' || normalizedTitle === 'review'
    const isDoneColumn = column.key === 'done' || normalizedTitle === 'done'

    const lane: CardLane = isBacklogColumn
        ? 'backlog'
        : isInProgressColumn
            ? 'inProgress'
            : isReviewColumn
                ? 'review'
                : isDoneColumn
                    ? 'done'
                    : 'other'

    const doneColumnIds = useMemo(
        () => Object.values(state.columns).filter((c) => (c.key === 'done') || c.title.trim().toLowerCase() === 'done').map((c) => c.id),
        [state.columns],
    )
    const doneCardIds = useMemo(() => new Set(doneColumnIds.flatMap((cid) => state.columns[cid]?.cardIds ?? [])), [doneColumnIds, state.columns])

    return (
        <UICard className="flex h-full min-h-0 flex-col">
            <CardHeader className="pt-4 pb-2">
                <CardTitle className="text-base">
                    {column.title} <span className="text-muted-foreground">({cards.length})</span>
                </CardTitle>
            </CardHeader>
            <CardContent
                ref={setNodeRef}
                className={`flex-1 min-h-0 space-y-2 overflow-y-auto ${isOver ? 'rounded-md bg-accent/30 transition-colors' : ''}`}
            >
                <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.map((c) => {
                        const deps = c?.dependsOn ?? []
                        const blocked = isCardBlocked(c.id)
                        const blockerLabels = deps
                            .filter((id) => !doneCardIds.has(id))
                            .map((id) => state.cards[id])
                            .filter(Boolean)
                            .map((dc) => `${dc.ticketKey ? `[${dc.ticketKey}] ` : ''}${dc.title}`)
                        return (
                            <DraggableCard
                                key={c.id}
                                card={c}
                                columnId={column.id}
                                projectId={projectId}
                                lane={lane}
                                isDone={isDoneColumn}
                                showAgentComingSoon={isReviewColumn}
                                blocked={blocked}
                                blockers={blockerLabels}
                                enhancementStatus={enhancementStatusByCardId?.[c.id]}
                                onCardEnhancementClick={onCardEnhancementClick}
                                onSelect={onSelectCard}
                                onEdit={onEditCard}
                                onEnhance={onEnhanceCard}
                            />
                        )
                    })}
                </SortableContext>
            </CardContent>
        </UICard>
    )
}
