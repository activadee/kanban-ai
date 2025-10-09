import {useEffect, useMemo, useState} from 'react'
import {Column} from './Column'
import {Separator} from '@/components/ui/separator'
import type {BoardState, Column as ColumnType} from 'shared'
import {Button} from '@/components/ui/button'
import {DndContext, DragOverlay} from '@dnd-kit/core'
import {KanbanCard} from './Card'
import {CreateCardDialog, EditCardDialog} from './CardDialogs'
import {ClipboardList} from 'lucide-react'
import {CardInspector} from './CardInspector'
import {ResizablePanelGroup, ResizablePanel, ResizableHandle} from '@/components/ui/resizable'
import {Sheet, SheetContent} from '@/components/ui/sheet'
import {useMediaQuery} from '@/lib/useMediaQuery'
import {useBoardDnd} from './board/useBoardDnd'
import {makeIsCardBlocked} from './board/isCardBlocked'

//

export type BoardHandlers = {
    onCreateCard: (columnId: string, values: {
        title: string;
        description: string;
        dependsOn?: string[]
    }) => Promise<void> | void
    onUpdateCard: (cardId: string, values: { title: string; description: string }) => Promise<void> | void
    onDeleteCard: (cardId: string) => Promise<void> | void
    onMoveCard: (cardId: string, toColumnId: string, toIndex: number) => Promise<void> | void
}

type Props = {
    projectId: string
    state: BoardState
    handlers: BoardHandlers
}

export function Board({projectId, state, handlers}: Props) {
    const columns = useMemo<ColumnType[]>(() => state.columnOrder.map((id) => state.columns[id]).filter(Boolean), [state])
    const totalCards = useMemo(() => Object.keys(state.cards).length, [state.cards])
    const [creatingColumnId, setCreatingColumnId] = useState<string | null>(null)
    const [editingCardId, setEditingCardId] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selectedCard = selectedId ? state.cards[selectedId] : undefined

    // Compute Done set and helper for blocked status
    const doneColumnIds = useMemo(() =>
        Object.values(state.columns)
            .filter((c) => (c.key === 'done') || c.title.trim().toLowerCase() === 'done')
            .map((c) => c.id), [state.columns])
    const doneCardIds = useMemo(() => new Set(doneColumnIds.flatMap((cid) => state.columns[cid]?.cardIds ?? [])), [doneColumnIds, state.columns])
    // local blocked helper replaced by makeIsCardBlocked

    useEffect(() => {
        if (selectedId && !selectedCard) {
            setSelectedId(null)
        }
    }, [selectedId, selectedCard])

    const isBlocked = makeIsCardBlocked(state)
    const {sensors, handleDragStart, handleDragEnd, activeId} = useBoardDnd({
        state,
        isCardBlocked: isBlocked,
        onMoveCard: (cardId, toColumnId, toIndex) => handlers.onMoveCard(cardId, toColumnId, toIndex),
    })

    const editingCard = editingCardId ? state.cards[editingCardId] ?? null : null
    const creatingColumn = creatingColumnId ? state.columns[creatingColumnId] ?? null : null

    const isDesktop = useMediaQuery('(min-width: 1024px)')

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Kanban Board</h1>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setCreatingColumnId(columns[0]?.id ?? null)} disabled={!columns.length}>
                        Create Ticket
                    </Button>
                </div>
            </div>
            <Separator className="mb-4 h-px w-full"/>

            {totalCards === 0 && (
                <div className="mb-6 flex items-center justify-center">
                    <div
                        className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/10 p-8 text-center">
                        <div className="rounded-full bg-muted/20 p-4">
                            <ClipboardList className="size-8 text-muted-foreground"/>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-semibold">Let’s create your first ticket</h2>
                            <p className="text-sm text-muted-foreground">
                                Drag and drop tickets between columns to track progress. Start by creating one in
                                Backlog.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                const targetColumnId = columns[0]?.id
                                if (targetColumnId) setCreatingColumnId(targetColumnId)
                            }}
                        >
                            Create Ticket
                        </Button>
                    </div>
                </div>
            )}

            {totalCards > 0 && (
                <>
                    {!isDesktop ? (
                        // Mobile Sheet only when not desktop
                        <Sheet open={!!selectedId} onOpenChange={(open) => {
                            if (!open) setSelectedId(null)
                        }}>
                            <SheetContent side="right">
                                {selectedId && selectedCard && (
                                    <CardInspector
                                        projectId={projectId}
                                        card={selectedCard}
                                        availableCards={Object.values(state.cards)
                                            .filter((c) => c.id !== selectedId && !doneCardIds.has(c.id))
                                            .map((c) => ({
                                                id: c.id,
                                                title: c.title,
                                                ticketKey: c.ticketKey ?? undefined
                                            }))}
                                        cardsIndex={new Map(Object.values(state.cards).map((c) => [c.id, {
                                            id: c.id,
                                            title: c.title,
                                            ticketKey: c.ticketKey ?? undefined
                                        }]))}
                                        blocked={isBlocked(selectedId)}
                                        onUpdate={(values) => handlers.onUpdateCard(selectedId, values)}
                                        onDelete={async () => {
                                            try {
                                                await handlers.onDeleteCard(selectedId)
                                                setSelectedId(null)
                                            } catch (error) {
                                                console.error('Failed to delete card', error)
                                            }
                                        }}
                                        onClose={() => setSelectedId(null)}
                                    />
                                )}
                            </SheetContent>
                        </Sheet>
                    ) : (
                        // Desktop resizable layout
                        <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                            <ResizablePanel defaultSize={selectedId ? 70 : 100} minSize={50}>
                                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                                    <div
                                        className="grid h-full min-h-0 grid-cols-1 gap-4 auto-rows-[minmax(0,1fr)] md:grid-cols-2 xl:grid-cols-4">
                                        {columns.map((col) => (
                                            <Column key={col.id} column={col} state={state}
                                                    onSelectCard={(cardId) => setSelectedId(cardId)}/>
                                        ))}
                                    </div>
                                    <DragOverlay dropAnimation={null}>
                                        {activeId ? <KanbanCard card={state.cards[activeId]}/> : null}
                                    </DragOverlay>
                                </DndContext>
                            </ResizablePanel>
                            {selectedId && selectedCard && (
                                <>
                                    <ResizableHandle withHandle/>
                                    <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="min-h-0">
                                        <div
                                            className="flex h-full min-h-0 flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
                                            <CardInspector
                                                projectId={projectId}
                                                card={selectedCard}
                                                availableCards={Object.values(state.cards)
                                                    .filter((c) => c.id !== selectedId && !doneCardIds.has(c.id))
                                                    .map((c) => ({
                                                        id: c.id,
                                                        title: c.title,
                                                        ticketKey: c.ticketKey ?? undefined
                                                    }))}
                                                cardsIndex={new Map(Object.values(state.cards).map((c) => [c.id, {
                                                    id: c.id,
                                                    title: c.title,
                                                    ticketKey: c.ticketKey ?? undefined
                                                }]))}
                                                blocked={isBlocked(selectedId)}
                                                locked={columns.some((c) => c.title === 'Done' && state.columns[c.id]?.cardIds.includes(selectedId))}
                                                onUpdate={(values) => handlers.onUpdateCard(selectedId, values)}
                                                onDelete={async () => {
                                                    try {
                                                        await handlers.onDeleteCard(selectedId)
                                                        setSelectedId(null)
                                                    } catch (error) {
                                                        console.error('Failed to delete card', error)
                                                    }
                                                }}
                                                onClose={() => setSelectedId(null)}
                                            />
                                        </div>
                                    </ResizablePanel>
                                </>
                            )}
                        </ResizablePanelGroup>
                    )}
                </>
            )}

            <CreateCardDialog
                open={!!creatingColumn}
                columns={columns.map((column) => ({id: column.id, title: column.title}))}
                defaultColumnId={creatingColumn?.id ?? columns[0]?.id}
                projectId={projectId}
                availableCards={Object.values(state.cards)
                    .filter((c) => !doneCardIds.has(c.id))
                    .map((c) => ({id: c.id, title: c.title, ticketKey: c.ticketKey ?? undefined}))}
                onOpenChange={(open) => {
                    if (!open) setCreatingColumnId(null)
                }}
                onSubmit={async (columnId, values) => {
                    await handlers.onCreateCard(columnId, values)
                }}
            />

            {editingCard && (
                <EditCardDialog
                    open={!!editingCard}
                    onOpenChange={(open) => {
                        if (!open) setEditingCardId(null)
                    }}
                    cardTitle={editingCard.title}
                    cardDescription={editingCard.description ?? ''}
                    cardTicketKey={editingCard.ticketKey ?? null}
                    projectId={projectId}
                    cardId={editingCard.id}
                    onSubmit={async (values) => {
                        await handlers.onUpdateCard(editingCard.id, values)
                    }}
                    onDelete={async () => {
                        await handlers.onDeleteCard(editingCard.id)
                    }}
                />
            )}
        </div>
    )
}
