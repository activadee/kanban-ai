import type {Hono} from "hono";
import {zValidator} from "@hono/zod-validator";
import type {AppEnv} from "../env";
import {
    listProjectAgentProfilesHandler,
    createProjectAgentProfileHandler,
    getProjectAgentProfileHandler,
    updateProjectAgentProfileHandler,
    deleteProjectAgentProfileHandler,
} from "./project.agents.handlers";
import {
    agentProfilePatchSchema,
    // For create we validate agent/name/config payload inline
} from "./project.schemas";
import {z} from "zod";

export const registerProjectAgentRoutes = (router: Hono<AppEnv>) => {
    router.get(
        "/:projectId/agents/profiles",
        (c) => listProjectAgentProfilesHandler(c),
    );

    router.post(
        "/:projectId/agents/profiles",
        zValidator(
            "json",
            z.object({
                agent: z.string(),
                name: z.string().min(1),
                config: z.any(),
            }),
        ),
        (c) => createProjectAgentProfileHandler(c),
    );

    router.get(
        "/:projectId/agents/profiles/:pid",
        (c) => getProjectAgentProfileHandler(c),
    );

    router.patch(
        "/:projectId/agents/profiles/:pid",
        zValidator("json", agentProfilePatchSchema),
        (c) => updateProjectAgentProfileHandler(c),
    );

    router.delete(
        "/:projectId/agents/profiles/:pid",
        (c) => deleteProjectAgentProfileHandler(c),
    );
};

