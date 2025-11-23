import {
    DragEndEvent,
    DragStartEvent,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core'
import {sortableKeyboardCoordinates} from '@dnd-kit/sortable'
import {useCallback, useState} from 'react'
import type {BoardState} from 'shared'

type DragData =
    | { type: 'card'; cardId: string; columnId: string }
    | { type: 'column'; columnId: string }

const isCardData = (data: DragData | undefined): data is Extract<DragData, { type: 'card' }> => data?.type === 'card'
const isColumnData = (data: DragData | undefined): data is Extract<DragData, {
    type: 'column'
}> => data?.type === 'column'

export function useBoardDnd({state, onMoveCard, isCardBlocked, onBlocked}: {
    state: BoardState
    onMoveCard: (cardId: string, toColumnId: string, toIndex: number) => void
    isCardBlocked: (cardId: string) => boolean
    onBlocked?: () => void
}) {
    const sensors = useSensors(
        useSensor(MouseSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 150, tolerance: 5}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
    )
    const [activeId, setActiveId] = useState<string | null>(null)

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(String(event.active.id))
    }, [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event
        setActiveId(null)
        if (!over) return

        const activeId = String(active.id)
        const overId = String(over.id)

        const activeData = active.data.current as DragData | undefined
        if (isCardData(activeData)) {
            const fromCol = state.columns[activeData.columnId]
            if (fromCol?.title === 'Done') return
        }

        const overData = over.data.current as DragData | undefined
        let toColumnId: string
        let toIndex: number

        if (isCardData(overData)) {
            toColumnId = overData.columnId
            const targetColumn = state.columns[toColumnId]
            if (!targetColumn) return
            const idx = targetColumn.cardIds.indexOf(overId)
            toIndex = idx === -1 ? targetColumn.cardIds.length : idx
        } else if (isColumnData(overData)) {
            toColumnId = overId
            const targetColumn = state.columns[toColumnId]
            if (!targetColumn) return
            toIndex = targetColumn.cardIds.length
        } else {
            const activeData2 = active.data.current as DragData | undefined
            const fallbackColumnId = isCardData(activeData2) ? activeData2.columnId : state.columnOrder[0]
            if (!fallbackColumnId) return
            const targetColumn = state.columns[fallbackColumnId]
            if (!targetColumn) return
            toColumnId = fallbackColumnId
            toIndex = targetColumn.cardIds.length
        }

        const targetCol = state.columns[toColumnId]
        const targetTitle = targetCol?.title?.trim().toLowerCase()
        if (targetTitle === 'in progress' && isCardBlocked(activeId)) {
            onBlocked?.()
            return
        }

        onMoveCard(activeId, toColumnId, toIndex)
    }, [isCardBlocked, onMoveCard, state])

    return {sensors, activeId, handleDragStart, handleDragEnd}
}
