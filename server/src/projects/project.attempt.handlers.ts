import {z} from "zod";
import {zValidator} from "@hono/zod-validator";
import {attempts, projectDeps, projectsRepo} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {createHandlers} from "../lib/factory";
import {loadBoardContext} from "../lib/middleware";
import {startAttemptSchema} from "../attempts/attempts.schemas";

const cardIdParam = z.object({projectId: z.string(), cardId: z.string()});

export const getProjectCardAttemptHandlers = createHandlers(
    zValidator("param", cardIdParam),
    loadBoardContext,
    async (c) => {
        const boardContext = c.get("boardContext");
        if (!boardContext) {
            return problemJson(c, {status: 404, detail: "Project not found"});
        }
        const {cardId} = c.req.valid("param");
        try {
            const data = await attempts.getLatestAttemptForCard(boardContext.boardId, cardId);
            if (!data) {
                return problemJson(c, {status: 404, detail: "Attempt not found"});
            }
            return c.json(data, 200);
        } catch (error) {
            log.error("attempts", "attempt failed", {err: error, boardId: boardContext.boardId, cardId});
            return problemJson(c, {
                status: 502,
                detail: error instanceof Error ? error.message : "Failed to fetch attempt",
            });
        }
    },
);

export const startProjectCardAttemptHandlers = createHandlers(
    zValidator("param", cardIdParam),
    zValidator("json", startAttemptSchema),
    loadBoardContext,
    async (c) => {
        const boardContext = c.get("boardContext");
        if (!boardContext) {
            return problemJson(c, {status: 404, detail: "Project not found"});
        }
        const {cardId} = c.req.valid("param");
        const body = c.req.valid("json");

        try {
            const {getCardById, getColumnById} = projectsRepo;

            const card = await getCardById(cardId);
            if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
            if (card.boardId && card.boardId !== boardContext.boardId) {
                return problemJson(c, {
                    status: 400,
                    detail: "Card does not belong to this project",
                });
            }
            const column = await getColumnById(card.columnId);
            const colTitle = (column?.title || "").trim().toLowerCase();
            if (colTitle === "done") {
                return problemJson(c, {
                    status: 409,
                    detail: "Task is done and locked",
                });
            }
            try {
                const {blocked} = await projectDeps.isCardBlocked(card.id);
                if (blocked) {
                    return problemJson(c, {
                        status: 409,
                        detail: "Task is blocked by dependencies",
                    });
                }
            } catch {}

            const events = c.get("events");
            const attempt = await attempts.startAttempt(
                {
                    boardId: boardContext.boardId,
                    cardId,
                    agent: body.agent,
                    profileId: body.profileId,
                    baseBranch: body.baseBranch,
                    branchName: body.branchName,
                },
                {events},
            );
            return c.json(attempt, 201);
        } catch (error) {
            log.error("attempts", "start project failed", {
                err: error,
                boardId: boardContext.boardId,
                cardId,
                agent: body.agent,
                profileId: body.profileId,
            });
            return problemJson(c, {
                status: 502,
                detail: error instanceof Error ? error.message : "Failed to start attempt",
            });
        }
    },
);
