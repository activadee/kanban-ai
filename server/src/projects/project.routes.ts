import {Hono} from "hono";
import type {AppEnv} from "../env";
import {
    listProjectsHandlers,
    createProjectHandlers,
    getProjectHandlers,
    getProjectSettingsHandlers,
    previewNextTicketKeyHandlers,
    updateProjectSettingsHandlers,
    listProjectBranchesHandlers,
    updateProjectHandlers,
    deleteProjectHandlers,
    getGithubOriginHandlers,
    getProjectCardAttemptHandlers,
    startProjectCardAttemptHandlers,
    getCardEnhancementsHandlers,
    setCardEnhancementHandlers,
    clearCardEnhancementHandlers,
    enhanceTicketHandlers,
} from "./project.handlers";
import {createProjectAgentProfilesRouter} from "./project.agents.routes";
import {createBoardRouter, resolveBoardForProject} from "./board.routes";

export const createProjectsRouter = () =>
    new Hono<AppEnv>()
        .get("/", ...listProjectsHandlers)
        .post("/", ...createProjectHandlers)
        .get("/:projectId", ...getProjectHandlers)
        .get("/:projectId/cards/:cardId/attempt", ...getProjectCardAttemptHandlers)
        .get("/:projectId/enhancements", ...getCardEnhancementsHandlers)
        .put("/:projectId/cards/:cardId/enhancement", ...setCardEnhancementHandlers)
        .delete("/:projectId/cards/:cardId/enhancement", ...clearCardEnhancementHandlers)
        .post("/:projectId/cards/:cardId/attempts", ...startProjectCardAttemptHandlers)
        .route("/:projectId/board", createBoardRouter(resolveBoardForProject))
        .route("/:projectId/agents/profiles", createProjectAgentProfilesRouter())
        .get("/:projectId/settings", ...getProjectSettingsHandlers)
        .get("/:projectId/tickets/next-key", ...previewNextTicketKeyHandlers)
        .post("/:projectId/tickets/enhance", ...enhanceTicketHandlers)
        .patch("/:projectId/settings", ...updateProjectSettingsHandlers)
        .get("/:projectId/git/branches", ...listProjectBranchesHandlers)
        .patch("/:projectId", ...updateProjectHandlers)
        .delete("/:projectId", ...deleteProjectHandlers)
        .get("/:projectId/github/origin", ...getGithubOriginHandlers);

export type ProjectsRoutes = ReturnType<typeof createProjectsRouter>;
