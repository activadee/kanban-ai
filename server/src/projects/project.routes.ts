import {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import type {AppEnv} from "../env";
import {
    createProjectSchema,
    updateProjectSchema,
    updateProjectSettingsSchema,
    enhanceTicketSchema,
    createSubtaskSchema,
    updateSubtaskSchema,
    reorderSubtasksSchema,
} from "./project.schemas";
import {
    listProjectsHandler,
    createProjectHandler,
    getProjectHandler,
    getProjectSettingsHandler,
    previewNextTicketKeyHandler,
    updateProjectSettingsHandler,
    listProjectBranchesHandler,
    updateProjectHandler,
    deleteProjectHandler,
    getGithubOriginHandler,
    getProjectCardAttemptHandler,
    startProjectCardAttemptHandler,
} from "./project.handlers";
import {registerProjectAgentRoutes} from "./project.agents.routes";
import {createBoardRouter, resolveBoardForProject} from "./board.routes";
import {problemJson} from "../http/problem";
import {startAttemptSchema} from "../attempts/attempts.schemas";
import {enhanceTicketHandler} from "./project.enhance.handlers";
import {
    listSubtasksForTicketHandler,
    createSubtaskForTicketHandler,
    updateSubtaskForProjectHandler,
    deleteSubtaskForProjectHandler,
    reorderSubtasksForTicketHandler,
} from "./project.subtasks.handlers";

export const createProjectsRouter = () => {
    const router = new Hono<AppEnv>();

    const loadProjectBoard = async (
        c: any,
    ): Promise<import("./board.routes").BoardContext | Response> => {
        const ctx = await resolveBoardForProject(c);
        if (!ctx) {
            return problemJson(c, {status: 404, detail: "Project not found"});
        }
        return ctx;
    };

    router.get("/", (c) => listProjectsHandler(c));

    router.post(
        "/",
        zValidator("json", createProjectSchema),
        (c) => createProjectHandler(c),
    );

    router.get("/:projectId", (c) => getProjectHandler(c));

    router.get(
        "/:projectId/cards/:cardId/attempt",
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return getProjectCardAttemptHandler(c, ctx);
        },
    );

    router.post(
        "/:projectId/cards/:cardId/attempts",
        zValidator("json", startAttemptSchema),
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return startProjectCardAttemptHandler(c, ctx);
        },
    );

    router.get(
        "/:projectId/tickets/:cardId/subtasks",
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return listSubtasksForTicketHandler(c, ctx);
        },
    );

    router.post(
        "/:projectId/tickets/:cardId/subtasks",
        zValidator("json", createSubtaskSchema),
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return createSubtaskForTicketHandler(c, ctx);
        },
    );

    router.patch(
        "/:projectId/subtasks/:subtaskId",
        zValidator("json", updateSubtaskSchema),
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return updateSubtaskForProjectHandler(c, ctx);
        },
    );

    router.delete(
        "/:projectId/subtasks/:subtaskId",
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return deleteSubtaskForProjectHandler(c, ctx);
        },
    );

    router.patch(
        "/:projectId/tickets/:cardId/subtasks/reorder",
        zValidator("json", reorderSubtasksSchema),
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            return reorderSubtasksForTicketHandler(c, ctx);
        },
    );

    router.route(
        "/:projectId/board",
        createBoardRouter(resolveBoardForProject),
    );

    router.get(
        "/:projectId/settings",
        (c) => getProjectSettingsHandler(c),
    );

    router.get(
        "/:projectId/tickets/next-key",
        (c) => previewNextTicketKeyHandler(c),
    );

    router.post(
        "/:projectId/tickets/enhance",
        zValidator("json", enhanceTicketSchema),
        (c) => enhanceTicketHandler(c),
    );

    router.patch(
        "/:projectId/settings",
        zValidator("json", updateProjectSettingsSchema),
        (c) => updateProjectSettingsHandler(c),
    );

    router.get(
        "/:projectId/git/branches",
        (c) => listProjectBranchesHandler(c),
    );

    router.patch(
        "/:projectId",
        zValidator("json", updateProjectSchema),
        (c) => updateProjectHandler(c),
    );

    router.delete("/:projectId", (c) => deleteProjectHandler(c));

    router.get(
        "/:projectId/github/origin",
        (c) => getGithubOriginHandler(c),
    );

    registerProjectAgentRoutes(router);

    return router;
};
