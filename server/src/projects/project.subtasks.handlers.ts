import type {BoardContext} from "./board.routes";
import {projectSubtasks, projectsRepo} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import type {
    CreateSubtaskRequest,
    UpdateSubtaskRequest,
    ReorderSubtasksRequest,
} from "shared";

const {getCardById, getColumnById} = projectsRepo;
const {
    listSubtasksWithProgress,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    reorderSubtasks,
    getSubtaskById,
} = projectSubtasks;

type CardCheck =
    | {card: any}
    | {error: {status: number; detail: string}};

async function ensureCardOnBoard(boardId: string, cardId: string): Promise<CardCheck> {
    const card = await getCardById(cardId);
    if (!card) {
        return {
            error: {
                status: 404,
                detail: "Card not found",
            } as const,
        };
    }
    let cardBoardId = card.boardId ?? null;
    if (!cardBoardId) {
        const column = await getColumnById(card.columnId);
        cardBoardId = column?.boardId ?? null;
    }
    if (cardBoardId !== boardId) {
        return {
            error: {
                status: 400,
                detail: "Card does not belong to this board",
            } as const,
        };
    }
    return {card};
}

export const listSubtasksForTicketHandler = async (c: any, ctx: BoardContext) => {
    const {boardId, project} = ctx;
    const cardId = c.req.param("cardId");

    const resolved = await ensureCardOnBoard(boardId, cardId);
    if ("error" in resolved) {
        return problemJson(c, resolved.error);
    }

    try {
        const {subtasks, progress} = await listSubtasksWithProgress(cardId);
        return c.json(
            {
                ticketId: cardId,
                subtasks,
                progress,
            },
            200,
        );
    } catch (error) {
        log.error(
            {err: error, boardId, projectId: project.id, cardId},
            "[projects:subtasks:list] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to load subtasks",
        });
    }
};

export const createSubtaskForTicketHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId, project} = ctx;
    const cardId = c.req.param("cardId");

    const resolved = await ensureCardOnBoard(boardId, cardId);
    if ("error" in resolved) {
        return problemJson(c, resolved.error);
    }

    const body = c.req.valid("json") as CreateSubtaskRequest;

    try {
        await createSubtask(cardId, body);
        const {subtasks, progress} = await listSubtasksWithProgress(cardId);
        return c.json(
            {
                ticketId: cardId,
                subtasks,
                progress,
            },
            201,
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to create subtask";
        log.error(
            {err: error, boardId, projectId: project.id, cardId},
            "[projects:subtasks:create] failed",
        );
        const status = msg === "ticket_not_found" ? 404 : 502;
        return problemJson(c, {
            status,
            detail: msg === "ticket_not_found" ? "Card not found" : msg,
        });
    }
};

export const updateSubtaskForProjectHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId, project} = ctx;
    const subtaskId = c.req.param("subtaskId");

    const existing = await getSubtaskById(subtaskId);
    if (!existing) {
        return problemJson(c, {status: 404, detail: "Subtask not found"});
    }

    const resolved = await ensureCardOnBoard(boardId, existing.ticketId);
    if ("error" in resolved) {
        return problemJson(c, resolved.error);
    }

    const body = c.req.valid("json") as UpdateSubtaskRequest;

    try {
        await updateSubtask(subtaskId, body);
        const {subtasks, progress} = await listSubtasksWithProgress(
            existing.ticketId,
        );
        return c.json(
            {
                ticketId: existing.ticketId,
                subtasks,
                progress,
            },
            200,
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to update subtask";
        log.error(
            {err: error, boardId, projectId: project.id, subtaskId},
            "[projects:subtasks:update] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: msg,
        });
    }
};

export const deleteSubtaskForProjectHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId, project} = ctx;
    const subtaskId = c.req.param("subtaskId");

    const existing = await getSubtaskById(subtaskId);
    if (!existing) {
        return problemJson(c, {status: 404, detail: "Subtask not found"});
    }

    const resolved = await ensureCardOnBoard(boardId, existing.ticketId);
    if ("error" in resolved) {
        return problemJson(c, resolved.error);
    }

    try {
        await deleteSubtask(subtaskId);
        const {subtasks, progress} = await listSubtasksWithProgress(
            existing.ticketId,
        );
        return c.json(
            {
                ticketId: existing.ticketId,
                subtasks,
                progress,
            },
            200,
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to delete subtask";
        log.error(
            {err: error, boardId, projectId: project.id, subtaskId},
            "[projects:subtasks:delete] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: msg,
        });
    }
};

export const reorderSubtasksForTicketHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId, project} = ctx;
    const cardId = c.req.param("cardId");

    const resolved = await ensureCardOnBoard(boardId, cardId);
    if ("error" in resolved) {
        return problemJson(c, resolved.error);
    }

    const body = c.req.valid("json") as ReorderSubtasksRequest;

    try {
        await reorderSubtasks(cardId, body.orderedIds);
        const {subtasks, progress} = await listSubtasksWithProgress(cardId);
        return c.json(
            {
                ticketId: cardId,
                subtasks,
                progress,
            },
            200,
        );
    } catch (error) {
        const msg =
            error instanceof Error ? error.message : "Failed to reorder subtasks";
        log.error(
            {err: error, boardId, projectId: project.id, cardId},
            "[projects:subtasks:reorder] failed",
        );
        const status = msg === "invalid_subtask_order" ? 400 : 502;
        return problemJson(c, {
            status,
            detail: msg,
        });
    }
};
