import {useMemo, useEffect} from 'react'
import {Card as UICard, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import type {BoardState, Column as TColumn} from 'shared'
import {useDroppable} from '@dnd-kit/core'
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {DraggableCard} from './DraggableCard'

type Props = {
    column: TColumn
    state: BoardState
    onSelectCard: (cardId: string) => void
}

export function Column({column, state, onSelectCard}: Props) {
    const cards = useMemo(
        () => column.cardIds.map((id) => state.cards[id]).filter(Boolean),
        [column.cardIds, state.cards]
    )
    const {setNodeRef, isOver} = useDroppable({id: column.id, data: {type: 'column', columnId: column.id}})

    const normalizedTitle = column.title.trim().toLowerCase()
    const isReviewColumn = column.key === 'review' || normalizedTitle === 'review'
    const isDoneColumn = column.key === 'done' || normalizedTitle === 'done'

    const doneColumnIds = useMemo(
        () => Object.values(state.columns).filter((c) => (c.key === 'done') || c.title.trim().toLowerCase() === 'done').map((c) => c.id),
        [state.columns],
    )
    const doneCardIds = useMemo(() => new Set(doneColumnIds.flatMap((cid) => state.columns[cid]?.cardIds ?? [])), [doneColumnIds, state.columns])

    useEffect(() => {
        if (!cards.length && isReviewColumn) {
            column.cardIds.push('__auto_review_placeholder__')
        }
    }, [isReviewColumn])

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
                        const blocked = deps.some((id) => !doneCardIds.has(id))
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
                                isDone={isDoneColumn}
                                showAgentComingSoon={isReviewColumn}
                                blocked={blocked}
                                blockers={blockerLabels}
                                onSelect={onSelectCard}
                            />
                        )
                    })}
                </SortableContext>
            </CardContent>
        </UICard>
    )
}
