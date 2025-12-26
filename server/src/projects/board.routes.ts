import {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import type {AppEnv} from "../env";
import type {ProjectSummary} from "shared";
import {tasks} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {startAttemptSchema} from "../attempts/attempts.schemas";
import {
    createCardSchema,
    updateCardSchema,
    boardGithubImportSchema,
} from "./project.schemas";
import {savePlanSchema} from './board.plan.schemas'
import {getBoardStateHandler} from "./board.state.handlers";
import {
    createCardHandler,
    updateCardHandler,
    deleteCardHandler,
} from "./board.card.handlers";
import {
    getCardAttemptForBoardHandler,
    startCardAttemptForBoardHandler,
} from "./board.attempt.handlers";
import {deleteCardPlanHandler, getCardPlanHandler, saveCardPlanHandler} from './board.plan.handlers'
import {importGithubIssuesHandler} from "./board.import.handlers";
import {getGithubIssueStatsHandler} from "./board.github.handlers";

export type BoardContext = {boardId: string; project: ProjectSummary};

export const resolveBoardForProject = async (
    c: any,
): Promise<BoardContext | null> => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return null;
    return {boardId: project.boardId ?? project.id, project};
};

export const resolveBoardById = async (
    c: any,
): Promise<BoardContext | null> => {
    const {projects} = c.get("services");
    const boardId = c.req.param("boardId");
    const project = await projects.get(boardId);
    if (!project) return null;
    return {boardId: project.boardId ?? project.id, project};
};

export function createBoardRouter(
    resolveBoard: (c: any) => Promise<BoardContext | null>,
) {
    const boardRouter = new Hono<AppEnv>();

    const loadContext = async (
        c: any,
    ): Promise<BoardContext | Response> => {
        const ctx = await resolveBoard(c);
        if (!ctx) return problemJson(c, {status: 404, detail: "Board not found"});
        return ctx;
    };

    boardRouter.get("/", async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        return getBoardStateHandler(c, ctx);
    });

    boardRouter.post(
        "/cards",
        zValidator("json", createCardSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            return createCardHandler(c, ctx);
        },
    );

    boardRouter.patch(
        "/cards/:cardId",
        zValidator("json", updateCardSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            return updateCardHandler(c, ctx);
        },
    );

    boardRouter.delete("/cards/:cardId", async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        return deleteCardHandler(c, ctx);
    });

    boardRouter.get("/cards/:cardId/attempt", async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        return getCardAttemptForBoardHandler(c, ctx);
    });

    boardRouter.post(
        "/cards/:cardId/attempts",
        zValidator("json", startAttemptSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            return startCardAttemptForBoardHandler(c, ctx);
        },
    );

    boardRouter.get('/cards/:cardId/plan', async (c) => {
        const ctx = await loadContext(c)
        if (ctx instanceof Response) return ctx
        return getCardPlanHandler(c, ctx)
    })

    boardRouter.post(
        '/cards/:cardId/plan',
        zValidator('json', savePlanSchema),
        async (c) => {
            const ctx = await loadContext(c)
            if (ctx instanceof Response) return ctx
            return saveCardPlanHandler(c, ctx)
        },
    )

    boardRouter.delete('/cards/:cardId/plan', async (c) => {
        const ctx = await loadContext(c)
        if (ctx instanceof Response) return ctx
        return deleteCardPlanHandler(c, ctx)
    })

    boardRouter.post(
        "/import/github/issues",
        zValidator("json", boardGithubImportSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            return importGithubIssuesHandler(c, ctx);
        },
    );

    boardRouter.get("/github/issues/stats", async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        return getGithubIssueStatsHandler(c, ctx);
    });

    return boardRouter;
}

export const createBoardsRouter = () => {
    const router = new Hono<AppEnv>();
    router.route("/:boardId", createBoardRouter(resolveBoardById));
    return router;
};
