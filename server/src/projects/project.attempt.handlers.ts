import {attempts, projectDeps, projectsRepo} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import type {BoardContext} from "./board.routes";

export const getProjectCardAttemptHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId} = ctx;
    try {
        const kind = (c.req.query('kind') || '').trim().toLowerCase()
        const cardId = c.req.param("cardId")
        const data = kind === 'planning'
            ? await attempts.getLatestPlanningAttemptForCard(boardId, cardId)
            : await attempts.getLatestAttemptForCard(boardId, cardId)
        if (!data) {
            return problemJson(c, {status: 404, detail: "Attempt not found"});
        }
        return c.json(data, 200);
    } catch (error) {
        log.error("attempts", "attempt failed", {err: error, boardId, cardId: c.req.param("cardId")});
        return problemJson(c, {
            status: 502,
            detail:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch attempt",
        });
    }
};

export const startProjectCardAttemptHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId} = ctx;
    const body = c.req.valid("json") as any;
    const isPlanningAttempt = body.isPlanningAttempt === true

    try {
        const {getCardById, getColumnById} = projectsRepo;

        const card = await getCardById(c.req.param("cardId"));
        if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
        if (card.boardId && card.boardId !== boardId) {
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
        if (!isPlanningAttempt) {
            try {
                const {blocked} = await projectDeps.isCardBlocked(card.id);
                if (blocked) {
                    return problemJson(c, {
                        status: 409,
                        detail: "Task is blocked by dependencies",
                    });
                }
            } catch {}
        }

        const events = c.get("events");
        const attempt = await attempts.startAttempt(
            {
                boardId,
                cardId: c.req.param("cardId"),
                agent: body.agent,
                profileId: body.profileId,
                baseBranch: body.baseBranch,
                branchName: body.branchName,
                isPlanningAttempt,
            },
            {events},
        );
        return c.json(attempt, 201);
    } catch (error) {
        log.error("attempts", "start project failed", {
            err: error,
            boardId,
            cardId: c.req.param("cardId"),
            agent: body.agent,
            profileId: body.profileId,
        });
        return problemJson(c, {
            status: 502,
            detail:
                error instanceof Error
                    ? error.message
                    : "Failed to start attempt",
        });
    }
};
