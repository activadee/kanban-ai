import {z} from "zod";
import {zValidator} from "@hono/zod-validator";
import {tasks} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {createHandlers} from "../lib/factory";
import {loadBoardContext} from "../lib/middleware";
import {setCardEnhancementSchema} from "./project.schemas";

const projectIdParam = z.object({projectId: z.string()});
const cardIdParam = z.object({projectId: z.string(), cardId: z.string()});

export const getCardEnhancementsHandlers = createHandlers(
    zValidator("param", projectIdParam),
    loadBoardContext,
    async (c) => {
        const boardContext = c.get("boardContext");
        if (!boardContext) {
            return problemJson(c, {status: 404, detail: "Project not found"});
        }
        try {
            const enhancements = await tasks.getCardEnhancements(boardContext.boardId);
            return c.json({enhancements}, 200);
        } catch (error) {
            log.error("projects:enhancements", "list failed", {
                err: error,
                boardId: boardContext.boardId,
            });
            return problemJson(c, {status: 502, detail: "Failed to fetch enhancements"});
        }
    },
);

export const setCardEnhancementHandlers = createHandlers(
    zValidator("param", cardIdParam),
    zValidator("json", setCardEnhancementSchema),
    loadBoardContext,
    async (c) => {
        const boardContext = c.get("boardContext");
        if (!boardContext) {
            return problemJson(c, {status: 404, detail: "Project not found"});
        }
        const {cardId} = c.req.valid("param");
        const body = c.req.valid("json");

        try {
            await tasks.setCardEnhancement(boardContext.boardId, cardId, {
                status: body.status,
                suggestion: body.suggestion
                    ? {
                          title: body.suggestion.title,
                          description: body.suggestion.description ?? undefined,
                      }
                    : undefined,
            });
            return c.json({ok: true}, 200);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to persist enhancement";
            const status = message === "Card not found" ? 404 : 502;
            if (status >= 500) {
                log.error("projects:enhancements", "set failed", {
                    err: error,
                    boardId: boardContext.boardId,
                    cardId,
                });
            }
            return problemJson(c, {status, detail: status === 404 ? "Card not found" : "Failed to persist enhancement"});
        }
    },
);

export const clearCardEnhancementHandlers = createHandlers(
    zValidator("param", cardIdParam),
    loadBoardContext,
    async (c) => {
        const boardContext = c.get("boardContext");
        if (!boardContext) {
            return problemJson(c, {status: 404, detail: "Project not found"});
        }
        const {cardId} = c.req.valid("param");
        try {
            await tasks.clearCardEnhancement(boardContext.boardId, cardId);
            return c.json({ok: true}, 200);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to clear enhancement";
            const status = message === "Card not found" ? 404 : 502;
            if (status >= 500) {
                log.error("projects:enhancements", "clear failed", {
                    err: error,
                    boardId: boardContext.boardId,
                    cardId,
                });
            }
            return problemJson(c, {status, detail: status === 404 ? "Card not found" : "Failed to clear enhancement"});
        }
    },
);
