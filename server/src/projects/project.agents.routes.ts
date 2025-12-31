import {Hono} from "hono";
import type {AppEnv} from "../env";
import {
    listProjectAgentProfilesHandlers,
    createProjectAgentProfileHandlers,
    getProjectAgentProfileHandlers,
    updateProjectAgentProfileHandlers,
    deleteProjectAgentProfileHandlers,
} from "./project.agents.handlers";

export const createProjectAgentProfilesRouter = () =>
    new Hono<AppEnv>()
        .get("/", ...listProjectAgentProfilesHandlers)
        .post("/", ...createProjectAgentProfileHandlers)
        .get("/:pid", ...getProjectAgentProfileHandlers)
        .patch("/:pid", ...updateProjectAgentProfileHandlers)
        .delete("/:pid", ...deleteProjectAgentProfileHandlers);

export type ProjectAgentProfilesRoutes = ReturnType<typeof createProjectAgentProfilesRouter>;
