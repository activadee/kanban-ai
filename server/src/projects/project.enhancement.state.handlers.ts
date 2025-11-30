import {tasks} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import type {BoardContext} from "./board.routes";

export const getCardEnhancementsHandler = async (c: any, ctx: BoardContext) => {
    try {
        const enhancements = await tasks.getCardEnhancements(ctx.boardId);
        return c.json({enhancements}, 200);
    } catch (error) {
        log.error("projects:enhancements", "list failed", {
            err: error,
            boardId: ctx.boardId,
        });
        return problemJson(c, {status: 502, detail: "Failed to fetch enhancements"});
    }
};

export const setCardEnhancementHandler = async (c: any, ctx: BoardContext) => {
    const cardId = c.req.param("cardId");
    const body = c.req.valid("json") as { status: "enhancing" | "ready"; suggestion?: { title: string; description?: string | null } };

    try {
        await tasks.setCardEnhancement(ctx.boardId, cardId, {
            status: body.status,
            suggestion: body.suggestion
                ? {
                      title: body.suggestion.title,
                      description: body.suggestion.description ?? undefined,
                  }
                : undefined,
        });
        return c.json({ok: true}, 200);
    } catch (error: any) {
        const message = error instanceof Error ? error.message : "Failed to persist enhancement";
        const status = message === "Card not found" ? 404 : 502;
        if (status >= 500) {
            log.error("projects:enhancements", "set failed", {
                err: error,
                boardId: ctx.boardId,
                cardId,
            });
        }
        return problemJson(c, {status, detail: status === 404 ? "Card not found" : "Failed to persist enhancement"});
    }
};

export const clearCardEnhancementHandler = async (c: any, ctx: BoardContext) => {
    const cardId = c.req.param("cardId");
    try {
        await tasks.clearCardEnhancement(ctx.boardId, cardId);
        return c.json({ok: true}, 200);
    } catch (error: any) {
        const message = error instanceof Error ? error.message : "Failed to clear enhancement";
        const status = message === "Card not found" ? 404 : 502;
        if (status >= 500) {
            log.error("projects:enhancements", "clear failed", {
                err: error,
                boardId: ctx.boardId,
                cardId,
            });
        }
        return problemJson(c, {status, detail: status === 404 ? "Card not found" : "Failed to clear enhancement"});
    }
};
