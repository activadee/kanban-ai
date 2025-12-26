import {useEffect, useMemo, useState} from "react";
import {Column} from "./Column";
import {Separator} from "@/components/ui/separator";
import type {BoardState, Column as ColumnType} from "shared";
import {Button} from "@/components/ui/button";
import {DndContext, DragOverlay} from "@dnd-kit/core";
import {KanbanCard} from "./Card";
import {CreateCardDialog, EditCardDialog, type CardFormValues} from "./CardDialogs";
import {ClipboardList} from "lucide-react";
import {CardInspector} from "./CardInspector";
import {Sheet, SheetContent} from "@/components/ui/sheet";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {useMediaQuery} from "@/lib/useMediaQuery";
import {useBoardDnd} from "./board/useBoardDnd";
import {makeIsCardBlocked} from "./board/isCardBlocked";
import type {CardEnhancementStatus} from "@/hooks/tickets";

export type BoardHandlers = {
    onCreateCard: (
        columnId: string,
        values: CardFormValues,
    ) => Promise<void> | void;
    /**
     * Optional variant of create that also triggers background enhancement.
     */
    onCreateAndEnhanceCard?: (
        columnId: string,
        values: CardFormValues,
    ) => Promise<void> | void;
    onUpdateCard: (
        cardId: string,
        values: CardFormValues,
    ) => Promise<void> | void;
    onDeleteCard: (cardId: string) => Promise<void> | void;
    onMoveCard: (
        cardId: string,
        toColumnId: string,
        toIndex: number,
    ) => Promise<void> | void;
    onMoveBlocked?: () => void;
    /**
     * Optional handler used when editing an existing ticket and triggering
     * background enhancement from the inspector or edit dialog.
     */
    onEnhanceCard?: (
        cardId: string,
        values: CardFormValues,
    ) => Promise<void> | void;
};

const DEFAULT_INSPECTOR_WIDTH = 480;
const MIN_INSPECTOR_WIDTH = 360;
const MAX_INSPECTOR_WIDTH = 900;

const FALLBACK_INSPECTOR_SIZE: { defaultSize: number; minSize: number; maxSize: number } = { defaultSize: 35, minSize: 22, maxSize: 65 } as const;

const computeInspectorSize = () => {
    if (typeof window === "undefined") return FALLBACK_INSPECTOR_SIZE;

    const vw = window.innerWidth || 1440;
    const toPercent = (px: number) => Math.min(95, Math.max(5, (px / vw) * 100));

    return {
        defaultSize: toPercent(DEFAULT_INSPECTOR_WIDTH),
        minSize: toPercent(MIN_INSPECTOR_WIDTH),
        maxSize: toPercent(Math.min(MAX_INSPECTOR_WIDTH, vw * 0.9)),
    } as const;
};

type Props = {
    projectId: string;
    state: BoardState;
    handlers: BoardHandlers;
    enhancementStatusByCardId?: Record<string, CardEnhancementStatus>;
    onCardEnhancementClick?: (cardId: string) => void;
    initialSelectedCardId?: string | null;
};

export function Board({
                          projectId,
                          state,
                          handlers,
                          enhancementStatusByCardId,
                          onCardEnhancementClick,
                          initialSelectedCardId,
                      }: Props) {
    const columns = useMemo<ColumnType[]>(
        () => state.columnOrder.map((id) => state.columns[id]).filter(Boolean),
        [state],
    );
    const totalCards = useMemo(
        () => Object.keys(state.cards).length,
        [state.cards],
    );
    const [creatingColumnId, setCreatingColumnId] = useState<string | null>(
        null,
    );
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editingCardAutoEnhance, setEditingCardAutoEnhance] =
        useState<boolean>(false);
    const [selectedId, setSelectedId] = useState<string | null>(
        initialSelectedCardId ?? null,
    );
    const resolvedSelectedId = useMemo(
        () => (selectedId && state.cards[selectedId] ? selectedId : null),
        [selectedId, state.cards],
    );
    // Compute Done set and helper for blocked status
    const doneColumnIds = useMemo(
        () =>
            Object.values(state.columns)
                .filter(
                    (c) =>
                        c.key === "done" ||
                        c.title.trim().toLowerCase() === "done",
                )
                .map((c) => c.id),
        [state.columns],
    );
    const doneCardIds = useMemo(
        () =>
            new Set(
                doneColumnIds.flatMap(
                    (cid) => state.columns[cid]?.cardIds ?? [],
                ),
            ),
        [doneColumnIds, state.columns],
    );
    // local blocked helper replaced by makeIsCardBlocked

    const isBlocked = makeIsCardBlocked(state);
    const { sensors, handleDragStart, handleDragEnd, activeId } = useBoardDnd({
        state,
        isCardBlocked: isBlocked,
        onMoveCard: (cardId, toColumnId, toIndex) =>
            handlers.onMoveCard(cardId, toColumnId, toIndex),
        onBlocked: handlers.onMoveBlocked,
    });

    const editingCard = editingCardId
        ? (state.cards[editingCardId] ?? null)
        : null;
    const creatingColumn = creatingColumnId
        ? (state.columns[creatingColumnId] ?? null)
        : null;

    const isDesktop = useMediaQuery("(min-width: 1024px)");

    const inspectorData = useMemo(() => {
        if (!resolvedSelectedId) return null;
        const card = state.cards[resolvedSelectedId];
        if (!card) return null;

        const availableCards = Object.values(state.cards)
            .filter(
                (c) => c.id !== resolvedSelectedId && !doneCardIds.has(c.id),
            )
            .map((c) => ({
                id: c.id,
                title: c.title,
                ticketKey: c.ticketKey ?? undefined,
            }));

        const cardsIndex = new Map(
            Object.values(state.cards).map((c) => [
                c.id,
                {
                    id: c.id,
                    title: c.title,
                    ticketKey: c.ticketKey ?? undefined,
                },
            ]),
        );

        const locked = columns.some(
            (c) =>
                c.title === "Done" &&
                state.columns[c.id]?.cardIds.includes(resolvedSelectedId),
        );

        return {
            card,
            availableCards,
            cardsIndex,
            blocked: isBlocked(resolvedSelectedId),
            locked,
        } as const;
    }, [
        columns,
        doneCardIds,
        isBlocked,
        resolvedSelectedId,
        state.cards,
        state.columns,
    ]);

    const [inspectorSize, setInspectorSize] = useState(FALLBACK_INSPECTOR_SIZE);

    useEffect(() => {
        const updateSize = () => setInspectorSize(computeInspectorSize());

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    useEffect(() => {
        if (!initialSelectedCardId) return;
        setSelectedId(initialSelectedCardId);
    }, [initialSelectedCardId]);

    const boardContent = (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full min-h-0 overflow-x-auto">
                <div className="flex h-full min-h-0 min-w-full items-stretch gap-4">
                    {columns.map((col) => (
                        <div
                            key={col.id}
                            className="h-full min-h-0 flex-1 min-w-[260px] sm:min-w-[280px] lg:min-w-[300px] xl:min-w-[320px] basis-0"
                        >
                            <Column
                                column={col}
                                state={state}
                                enhancementStatusByCardId={
                                    enhancementStatusByCardId
                                }
                                onCardEnhancementClick={
                                    onCardEnhancementClick
                                }
                                projectId={projectId}
                                isCardBlocked={isBlocked}
                                onSelectCard={(cardId) =>
                                    setSelectedId(cardId)
                                }
                                onEditCard={(cardId) => {
                                    setEditingCardId(cardId);
                                    setEditingCardAutoEnhance(false);
                                }}
                                onEnhanceCard={(cardId) => {
                                    setEditingCardId(cardId);
                                    setEditingCardAutoEnhance(true);
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <DragOverlay dropAnimation={null}>
                {activeId ? <KanbanCard card={state.cards[activeId]} /> : null}
            </DragOverlay>
        </DndContext>
    );

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Kanban Board</h1>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() =>
                            setCreatingColumnId(columns[0]?.id ?? null)
                        }
                        disabled={!columns.length}
                    >
                        Create Ticket
                    </Button>
                </div>
            </div>
            <Separator className="mb-4 h-px w-full" />

            {totalCards === 0 && (
                <div className="mb-6 flex items-center justify-center">
                    <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/10 p-8 text-center">
                        <div className="rounded-full bg-muted/20 p-4">
                            <ClipboardList className="size-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-semibold">
                                Let's create your first ticket
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Drag and drop tickets between columns to track
                                progress. Start by creating one in Backlog.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                const targetColumnId = columns[0]?.id;
                                if (targetColumnId)
                                    setCreatingColumnId(targetColumnId);
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
                        // Mobile/tablet: render board plus inspector sheet overlay
                        <>
                            {boardContent}
                            <Sheet
                                open={!!resolvedSelectedId}
                                onOpenChange={(open) => {
                                    if (!open) setSelectedId(null);
                                }}
                            >
                                <SheetContent side="right">
                                    {resolvedSelectedId && inspectorData && (
                                        <CardInspector
                                            projectId={projectId}
                                            card={inspectorData.card}
                                            availableCards={inspectorData.availableCards}
                                            cardsIndex={inspectorData.cardsIndex}
                                            blocked={inspectorData.blocked}
                                            onUpdate={(values) =>
                                                handlers.onUpdateCard(
                                                    resolvedSelectedId,
                                                    values,
                                                )
                                            }
                                            onEnhanceCard={
                                                handlers.onEnhanceCard
                                                    ? (values) =>
                                                        handlers.onEnhanceCard?.(
                                                            resolvedSelectedId,
                                                            values,
                                                        )
                                                    : undefined
                                            }
                                            onDelete={async () => {
                                                try {
                                                    await handlers.onDeleteCard(
                                                        resolvedSelectedId,
                                                    );
                                                    setSelectedId(null);
                                                } catch (error) {
                                                    console.error(
                                                        "Failed to delete card",
                                                        error,
                                                    );
                                                }
                                            }}
                                            onClose={() => setSelectedId(null)}
                                        />
                                    )}
                                </SheetContent>
                            </Sheet>
                        </>
                    ) : (
                        <div className="flex-1 min-h-0">
                            {resolvedSelectedId && inspectorData ? (
                                <ResizablePanelGroup
                                    direction="horizontal"
                                    autoSaveId="kanban-board-inspector"
                                    className="h-full min-h-0"
                                >
                                    <ResizablePanel
                                        id="kanban-board"
                                        minSize={`${Math.max(10, 100 - inspectorSize.maxSize)}`}
                                        defaultSize={`${Math.max(15, 100 - inspectorSize.defaultSize)}`}
                                    >
                                        {boardContent}
                                    </ResizablePanel>
                                    <ResizableHandle
                                        withHandle
                                        className="bg-border/70 w-1"
                                    />
                                    <ResizablePanel
                                        id="kanban-inspector"
                                        minSize={`${inspectorSize.minSize}`}
                                        maxSize={`${inspectorSize.maxSize}`}
                                        defaultSize={`${inspectorSize.defaultSize}`}
                                    >
                                        <div className="flex h-full min-h-0 flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 shadow-xl">
                                            <CardInspector
                                                projectId={projectId}
                                                card={inspectorData.card}
                                                availableCards={
                                                    inspectorData.availableCards
                                                }
                                                cardsIndex={
                                                    inspectorData.cardsIndex
                                                }
                                                blocked={
                                                    inspectorData.blocked
                                                }
                                                locked={inspectorData.locked}
                                                onUpdate={(values) =>
                                                    handlers.onUpdateCard(
                                                        resolvedSelectedId,
                                                        values,
                                                    )
                                                }
                                                onEnhanceCard={
                                                    handlers.onEnhanceCard
                                                        ? (values) =>
                                                            handlers.onEnhanceCard?.(
                                                                resolvedSelectedId,
                                                                values,
                                                            )
                                                        : undefined
                                                }
                                                onDelete={async () => {
                                                    try {
                                                        await handlers.onDeleteCard(
                                                            resolvedSelectedId,
                                                        );
                                                        setSelectedId(null);
                                                    } catch (error) {
                                                        console.error(
                                                            "Failed to delete card",
                                                            error,
                                                        );
                                                    }
                                                }}
                                                onClose={() =>
                                                    setSelectedId(null)
                                                }
                                            />
                                        </div>
                                    </ResizablePanel>
                                </ResizablePanelGroup>
                            ) : (
                                boardContent
                            )}
                        </div>
                    )}
                </>
            )}

            <CreateCardDialog
                open={!!creatingColumn}
                columns={columns.map((column) => ({
                    id: column.id,
                    title: column.title,
                }))}
                defaultColumnId={creatingColumn?.id ?? columns[0]?.id}
                projectId={projectId}
                availableCards={Object.values(state.cards)
                    .filter((c) => !doneCardIds.has(c.id))
                    .map((c) => ({
                        id: c.id,
                        title: c.title,
                        ticketKey: c.ticketKey ?? undefined,
                    }))}
                onOpenChange={(open) => {
                    if (!open) setCreatingColumnId(null);
                }}
                onSubmit={async (columnId, values) => {
                    await handlers.onCreateCard(columnId, values);
                }}
                onCreateAndEnhance={
                    handlers.onCreateAndEnhanceCard
                        ? async (columnId, values) => {
                            await handlers.onCreateAndEnhanceCard?.(columnId, values)
                        }
                        : undefined
                }
            />

            {editingCard && (
                <EditCardDialog
                    open={!!editingCard}
                    onOpenChange={(open) => {
                        if (!open) setEditingCardId(null);
                    }}
                    cardTitle={editingCard.title}
                    cardDescription={editingCard.description ?? ""}
                    cardTicketKey={editingCard.ticketKey ?? null}
                    cardTicketType={editingCard.ticketType ?? null}
                    projectId={projectId}
                    cardId={editingCard.id}
                    autoEnhanceOnOpen={editingCardAutoEnhance}
                    onSubmit={async (values) => {
                        await handlers.onUpdateCard(editingCard.id, values);
                    }}
                    onEnhanceInBackground={
                        handlers.onEnhanceCard
                            ? async (values) => {
                                await handlers.onEnhanceCard?.(
                                    editingCard.id,
                                    values,
                                );
                            }
                            : undefined
                    }
                    onDelete={async () => {
                        await handlers.onDeleteCard(editingCard.id);
                    }}
                />
            )}
        </div>
    );
}
