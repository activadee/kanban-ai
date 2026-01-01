import {useMemo} from 'react'
import {Card as UICard, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import type {BoardState, Column as TColumn} from 'shared'
import type {AttemptStatus} from 'shared'
import {useDroppable} from '@dnd-kit/core'
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {DraggableCard} from './DraggableCard'
import type {CardEnhancementStatus} from '@/hooks/tickets'
import type {CardLane} from './cardLane'
import {sortCardsByDate, type CardSortOrder} from '@/lib/sortOrder'

type Props = {
    column: TColumn
    state: BoardState
    onSelectCard: (cardId: string) => void
    selectedCardId?: string | null
    enhancementStatusByCardId?: Record<string, CardEnhancementStatus>
    attemptStatusByCardId?: Record<string, AttemptStatus>
    onCardEnhancementClick?: (cardId: string) => void
    onEditCard: (cardId: string) => void
    onEnhanceCard: (cardId: string) => void
    projectId: string
    isCardBlocked: (cardId: string) => boolean
    sortOrder?: CardSortOrder
}

export function Column({
                           column,
                           state,
                           onSelectCard,
                           selectedCardId,
                           enhancementStatusByCardId,
                           attemptStatusByCardId,
                           onCardEnhancementClick,
                           onEditCard,
                           onEnhanceCard,
                           projectId,
                           isCardBlocked,
                           sortOrder = 'custom',
                       }: Props) {
    const cards = useMemo(
        () => {
            const allCards = column.cardIds.map((id) => state.cards[id]).filter(Boolean);
            return sortCardsByDate(allCards, sortOrder);
        },
        [column.cardIds, state.cards, sortOrder]
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

    const laneTopBorderColor: Record<CardLane, string> = {
        backlog: 'bg-amber-500',
        inProgress: 'bg-blue-500',
        review: 'bg-violet-500',
        done: 'bg-emerald-500',
        other: 'bg-slate-500',
    }

    const doneColumnIds = useMemo(
        () => Object.values(state.columns).filter((c) => (c.key === 'done') || c.title.trim().toLowerCase() === 'done').map((c) => c.id),
        [state.columns],
    )
    const doneCardIds = useMemo(() => new Set(doneColumnIds.flatMap((cid) => state.columns[cid]?.cardIds ?? [])), [doneColumnIds, state.columns])

    return (
        <UICard className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className={`h-1 w-full shrink-0 ${laneTopBorderColor[lane]}`} />
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
                                selected={selectedCardId === c.id}
                                enhancementStatus={enhancementStatusByCardId?.[c.id]}
                                attemptStatus={attemptStatusByCardId?.[c.id]}
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
