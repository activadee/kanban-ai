import type {BoardContext} from "./board.routes";
import {attempts, projectDeps, projectsRepo} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";

const {getCardById, getColumnById} = projectsRepo;

export const getCardAttemptForBoardHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId} = ctx;
    try {
        const data = await attempts.getLatestAttemptForCard(
            boardId,
            c.req.param("cardId"),
        );
        if (!data) {
            return problemJson(c, {status: 404, detail: "Attempt not found"});
        }
        return c.json(data, 200);
    } catch (error) {
        log.error("attempts", "attempt failed", {
            err: error,
            boardId,
            cardId: c.req.param("cardId"),
        });
        return problemJson(c, {
            status: 502,
            detail:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch attempt",
        });
    }
};

export const startCardAttemptForBoardHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId, project} = ctx;
    const body = c.req.valid("json") as any;

    try {
        // Disallow starting attempts for tasks already in Done/blocked
        const card = await getCardById(c.req.param("cardId"));
        if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
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
                boardId,
                cardId: c.req.param("cardId"),
                agent: body.agent,
                profileId: body.profileId,
                baseBranch: body.baseBranch,
                branchName: body.branchName,
            },
            {events},
        );

        // These headers are part of the existing API surface and must be preserved
        c.header("Deprecation", "true");
        c.header(
            "Link",
            `</api/v1/projects/${project.id}/cards/${c.req.param("cardId")}/attempts>; rel="successor-version"`,
        );

        return c.json(attempt, 201);
    } catch (error) {
        log.error("attempts", "start failed", {
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
