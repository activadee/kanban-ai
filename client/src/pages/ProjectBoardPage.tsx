import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Board } from "@/components/kanban/Board";
import { CardEnhancementDialog } from "@/components/kanban/card-dialogs/CardEnhancementDialog";
import { ImportIssuesDialog } from "@/components/github/ImportIssuesDialog";
import { ConnectionLostDialog } from "@/components/system/ConnectionLostDialog";
import {
    useBoardState,
    useCreateCard,
    useDeleteCard,
    useMoveCard,
    useProject,
    useUpdateCard,
    useTicketEnhancementQueue,
} from "@/hooks";
import type { MoveCardResponse } from "@/api/board";
import type { BoardState } from "shared";
import { boardKeys } from "@/hooks/board";
import { useKanbanWS } from "@/lib/ws";
import { toast } from "@/components/ui/toast.tsx";
import { eventBus } from "@/lib/events.ts";
import { describeApiError } from "@/api/http";

export function ProjectBoardPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const {
        data: project,
        isLoading,
        isError,
        error: queryError,
    } = useProject(projectId);

    const boardId = project?.boardId ?? project?.id ?? null;

    const boardQuery = useBoardState(boardId ?? undefined, {
        enabled: Boolean(boardId),
    });
    const boardState = boardQuery.data;

    const {
        connected,
        reconnecting,
        state: socketState,
    } = useKanbanWS(boardId ?? null);
    const [importOpen, setImportOpen] = useState(false);

    const invalidateBoard = () => {
        if (!boardId) return;
        queryClient.invalidateQueries({ queryKey: boardKeys.state(boardId) });
    };

    const applyMovePatch = (payload?: MoveCardResponse) => {
        if (!boardId || !payload) return;
        queryClient.setQueryData<BoardState | undefined>(
            boardKeys.state(boardId),
            (prev) => {
                if (!prev) return prev;
                const existingCard = prev.cards[payload.card.id] ?? {};
                const nextCards = {
                    ...prev.cards,
                    [payload.card.id]: { ...existingCard, ...payload.card },
                };
                const nextColumns = { ...prev.columns };
                for (const [colId, col] of Object.entries(payload.columns)) {
                    const existing = nextColumns[colId];
                    nextColumns[colId] = existing
                        ? {
                              ...existing,
                              title: col.title,
                              cardIds: col.cardIds,
                          }
                        : col;
                }
                return { ...prev, cards: nextCards, columns: nextColumns };
            },
        );
    };

    const createCardMutation = useCreateCard({ onSuccess: invalidateBoard });
    const updateCardMutation = useUpdateCard({ onSuccess: invalidateBoard });
    const deleteCardMutation = useDeleteCard({ onSuccess: invalidateBoard });
    const moveCardMutation = useMoveCard({
        onSuccess: (data) => applyMovePatch(data),
    });

    const {
        enhancements,
        startEnhancementForNewCard,
        startEnhancementForExistingCard,
        clearEnhancement,
    } = useTicketEnhancementQueue();

    const enhancementStatusByCardId = useMemo(() => {
        const entries = Object.entries(enhancements);
        if (!entries.length) return {} as Record<string, import("@/hooks/tickets").CardEnhancementStatus>;
        const result: Record<string, import("@/hooks/tickets").CardEnhancementStatus> = {};
        for (const [cardId, entry] of entries) {
            result[cardId] = entry.status;
        }
        return result;
    }, [enhancements]);

    const [enhancementDialogCardId, setEnhancementDialogCardId] = useState<string | null>(null);

    const connectionLabel = reconnecting
        ? "Reconnecting…"
        : connected
          ? "Connected"
          : "Connecting…";
    const connectionBadgeVariant = reconnecting
        ? "destructive"
        : connected
          ? "secondary"
          : "outline";

    useEffect(() => {
        return eventBus.on("attempt_log", (p) => {
            if (
                p.message?.toLowerCase().includes("cleanup") ||
                p.message?.includes("[cleanup]")
            ) {
                toast({
                    title: "Cleaned worktree",
                    description: p.message,
                    variant: "success",
                });
            }
        });
    }, []);

    useEffect(() => {
        if (boardId && socketState) {
            queryClient.setQueryData<BoardState | undefined>(
                boardKeys.state(boardId),
                socketState,
            );
        }
    }, [boardId, socketState, queryClient]);

    if (!projectId) {
        return (
            <div className="p-4">
                <p className="text-sm text-destructive">
                    Missing project identifier.
                </p>
                <Button variant="link" onClick={() => navigate("/")}>
                    Back to projects
                </Button>
            </div>
        );
    }

    if (isLoading || boardQuery.isLoading) {
        return (
            <div className="p-10 text-muted-foreground">Loading project…</div>
        );
    }

    if (isError || !project || !boardState || !boardId) {
        return (
            <div className="p-10 space-y-4">
                <p className="text-sm text-destructive">
                    {queryError?.message ?? "Project not found."}
                </p>
                <Button onClick={() => navigate("/")}>Back to projects</Button>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-2">
                    <img src={"/vite.svg"} className="h-6 w-6" />
                    <div className="text-xl font-semibold">{project.name}</div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={connectionBadgeVariant}>
                        {connectionLabel}
                    </Badge>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setImportOpen(true)}
                    >
                        Import GitHub issues
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 px-4 pb-4">
                <Board
                    projectId={project.id}
                    state={boardState}
                    enhancementStatusByCardId={enhancementStatusByCardId}
                    onCardEnhancementClick={(cardId) =>
                        setEnhancementDialogCardId(cardId)
                    }
                    handlers={{
                        onCreateCard: async (
                            columnId,
                            values: {
                                title: string;
                                description: string;
                                dependsOn?: string[];
                            },
                        ) => {
                            try {
                                await createCardMutation.mutateAsync({
                                    boardId,
                                    columnId,
                                    values: {
                                        title: values.title,
                                        description:
                                            values.description || undefined,
                                        dependsOn: values.dependsOn ?? [],
                                    },
                                });
                            } catch (err) {
                                console.error("Create card failed", err);
                                const problem = describeApiError(
                                    err,
                                    "Failed to create card",
                                );
                                toast({
                                    title: problem.title,
                                    description: problem.description,
                                    variant: "destructive",
                                });
                            }
                        },
                        onCreateAndEnhanceCard: async (
                            columnId,
                            values: {
                                title: string;
                                description: string;
                                dependsOn?: string[];
                            },
                        ) => {
                            try {
                                const result = await createCardMutation.mutateAsync({
                                    boardId,
                                    columnId,
                                    values: {
                                        title: values.title,
                                        description:
                                            values.description || undefined,
                                        dependsOn: values.dependsOn ?? [],
                                    },
                                });
                                const cardId = result.cardId;
                                if (cardId) {
                                    await startEnhancementForNewCard({
                                        projectId: project.id,
                                        cardId,
                                        title: values.title,
                                        description: values.description,
                                    });
                                }
                            } catch (err) {
                                console.error("Create & enhance card failed", err);
                                const problem = describeApiError(
                                    err,
                                    "Failed to create card",
                                );
                                toast({
                                    title: problem.title,
                                    description: problem.description,
                                    variant: "destructive",
                                });
                            }
                        },
                        onUpdateCard: async (
                            cardId,
                            values: {
                                title: string;
                                description: string;
                                dependsOn?: string[];
                            },
                        ) => {
                            try {
                                await updateCardMutation.mutateAsync({
                                    boardId,
                                    cardId,
                                    values: {
                                        title: values.title,
                                        description:
                                            values.description || undefined,
                                        dependsOn: values.dependsOn,
                                    },
                                });
                            } catch (err) {
                                console.error("Update card failed", err);
                                const problem = describeApiError(
                                    err,
                                    "Failed to update card",
                                );
                                toast({
                                    title: problem.title,
                                    description: problem.description,
                                    variant: "destructive",
                                });
                            }
                        },
                        onDeleteCard: async (cardId) => {
                            try {
                                await deleteCardMutation.mutateAsync({
                                    boardId,
                                    cardId,
                                });
                            } catch (err) {
                                console.error("Delete card failed", err);
                                const problem = describeApiError(
                                    err,
                                    "Failed to delete card",
                                );
                                toast({
                                    title: problem.title,
                                    description: problem.description,
                                    variant: "destructive",
                                });
                            }
                        },
                        onMoveCard: async (cardId, toColumnId, toIndex) => {
                            try {
                                await moveCardMutation.mutateAsync({
                                    boardId,
                                    cardId,
                                    toColumnId,
                                    toIndex,
                                });
                            } catch (err) {
                                console.error("Move card failed", err);
                                const { description, status } = describeApiError(
                                    err,
                                    "Failed to move card",
                                );
                                if (status === 409) {
                                    toast({
                                        title: "Task is blocked by dependencies",
                                        description:
                                            description ||
                                            "Complete required dependencies before moving this card to In Progress.",
                                        variant: "destructive",
                                    });
                                } else {
                                    toast({
                                        title: "Failed to move card",
                                        description,
                                        variant: "destructive",
                                    });
                                }
                            }
                        },
                        onEnhanceCard: async (
                            cardId,
                            values: {
                                title: string;
                                description: string;
                                dependsOn?: string[];
                            },
                        ) => {
                            try {
                                await startEnhancementForExistingCard({
                                    projectId: project.id,
                                    cardId,
                                    title: values.title,
                                    description: values.description,
                                });
                            } catch (err) {
                                console.error(
                                    "Enhance existing card failed",
                                    err,
                                );
                            }
                        },
                        onMoveBlocked: () => {
                            toast({
                                title: "Task is blocked by dependencies",
                                description:
                                    "Complete required dependencies before moving this card to In Progress.",
                                variant: "destructive",
                            });
                        },
                    }}
                />
            </div>
            <CardEnhancementDialog
                open={Boolean(
                    enhancementDialogCardId &&
                        enhancements[enhancementDialogCardId]?.suggestion,
                )}
                onOpenChange={(open) => {
                    if (!open) setEnhancementDialogCardId(null);
                }}
                current={{
                    title:
                        (enhancementDialogCardId &&
                            boardState.cards[enhancementDialogCardId]?.title) ||
                        "",
                    description:
                        (enhancementDialogCardId &&
                            boardState.cards[enhancementDialogCardId]
                                ?.description) ||
                        "",
                }}
                enhanced={{
                    title:
                        (enhancementDialogCardId &&
                            enhancements[enhancementDialogCardId]?.suggestion
                                ?.title) ||
                        "",
                    description:
                        (enhancementDialogCardId &&
                            enhancements[enhancementDialogCardId]?.suggestion
                                ?.description) ||
                        "",
                }}
                onAccept={async () => {
                    if (!enhancementDialogCardId) return;
                    const suggestion =
                        enhancements[enhancementDialogCardId]?.suggestion;
                    if (!suggestion) return;
                    try {
                        await updateCardMutation.mutateAsync({
                            boardId,
                            cardId: enhancementDialogCardId,
                            values: {
                                title: suggestion.title,
                                description: suggestion.description,
                            },
                        });
                        clearEnhancement(enhancementDialogCardId);
                        setEnhancementDialogCardId(null);
                    } catch (err) {
                        console.error(
                            "Accept enhancement update failed",
                            err,
                        );
                        const problem = describeApiError(
                            err,
                            "Failed to apply enhancement",
                        );
                        toast({
                            title: problem.title,
                            description: problem.description,
                            variant: "destructive",
                        });
                    }
                }}
                onReject={async () => {
                    if (!enhancementDialogCardId) return;
                    clearEnhancement(enhancementDialogCardId);
                    setEnhancementDialogCardId(null);
                }}
            />
            <ImportIssuesDialog
                projectId={projectId}
                boardId={boardId}
                open={importOpen}
                onOpenChange={setImportOpen}
                onImported={() => invalidateBoard()}
            />
            <ConnectionLostDialog open={reconnecting} />
        </div>
    );
}
