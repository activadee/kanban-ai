import {z} from "zod";
import {zValidator} from "@hono/zod-validator";
import {agentProfiles} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {getAgent} from "../agents/registry";
import {createHandlers} from "../lib/factory";
import {agentProfilePatchSchema} from "./project.schemas";

const MAX_PROMPT_CHARS = 4000;

const projectIdParam = z.object({projectId: z.string()});
const profileIdParam = z.object({projectId: z.string(), pid: z.string()});
const createProfileBody = z.object({
    agent: z.string(),
    name: z.string().min(1),
    config: z.any(),
});

function validateProfilePromptLengths(config: unknown) {
    const cfg = config as Record<string, unknown> | null | undefined;
    if (!cfg || typeof cfg !== "object") return null;

    const errors: Record<string, string[]> = {};

    const append = cfg.appendPrompt;
    if (typeof append === "string" && append.length > MAX_PROMPT_CHARS) {
        errors.appendPrompt = [
            `appendPrompt must be at most ${MAX_PROMPT_CHARS} characters`,
        ];
    }

    const inline = cfg.inlineProfile;
    if (typeof inline === "string" && inline.length > MAX_PROMPT_CHARS) {
        errors.inlineProfile = [
            `inlineProfile must be at most ${MAX_PROMPT_CHARS} characters`,
        ];
    }

    return Object.keys(errors).length ? errors : null;
}

export const listProjectAgentProfilesHandlers = createHandlers(
    zValidator("param", projectIdParam),
    async (c) => {
        const {projectId} = c.req.valid("param");
        try {
            const rows = await agentProfiles.listAgentProfiles(projectId);
            return c.json({profiles: rows}, 200);
        } catch (error) {
            log.error("agents:profiles", "list failed", {err: error, projectId});
            return problemJson(c, {status: 502, detail: "Failed to list profiles"});
        }
    },
);

export const createProjectAgentProfileHandlers = createHandlers(
    zValidator("param", projectIdParam),
    zValidator("json", createProfileBody),
    async (c) => {
        const {projectId} = c.req.valid("param");
        const {agent: agentKey, name, config} = c.req.valid("json");
        try {
            const events = c.get("events");
            const agent = getAgent(agentKey);
            if (!agent) return problemJson(c, {status: 400, detail: "Unknown agent"});
            const parsed = agent.profileSchema.safeParse(config);
            if (!parsed.success) {
                return problemJson(c, {
                    status: 400,
                    title: "Invalid profile",
                    detail: parsed.error.message,
                    errors: parsed.error.flatten(),
                });
            }
            const lengthErrors = validateProfilePromptLengths(parsed.data);
            if (lengthErrors) {
                return problemJson(c, {
                    status: 400,
                    title: "Invalid profile",
                    detail: "Profile prompts are too long",
                    errors: {fieldErrors: lengthErrors, formErrors: []},
                });
            }
            const row = await agentProfiles.createAgentProfile(projectId, agentKey, name, parsed.data);
            events.publish("agent.profile.changed", {
                profileId: row.id,
                agent: row.agent,
                kind: "created",
                label: row.name,
            });
            return c.json(row, 201);
        } catch (error) {
            log.error("agents:profiles", "create failed", {err: error, projectId, agent: agentKey, name});
            return problemJson(c, {status: 502, detail: "Failed to create profile"});
        }
    },
);

export const getProjectAgentProfileHandlers = createHandlers(
    zValidator("param", profileIdParam),
    async (c) => {
        const {projectId, pid} = c.req.valid("param");
        try {
            const row = await agentProfiles.getAgentProfile(projectId, pid);
            if (!row) {
                return problemJson(c, {status: 404, detail: "Profile not found"});
            }
            return c.json(row, 200);
        } catch (error) {
            log.error("agents:profiles", "get failed", {err: error, projectId, profileId: pid});
            return problemJson(c, {status: 502, detail: "Failed to fetch profile"});
        }
    },
);

export const updateProjectAgentProfileHandlers = createHandlers(
    zValidator("param", profileIdParam),
    zValidator("json", agentProfilePatchSchema),
    async (c) => {
        const {projectId, pid} = c.req.valid("param");
        const patch = c.req.valid("json");
        try {
            const events = c.get("events");
            let cfg = patch.config;
            if (cfg !== undefined) {
                const existing = await agentProfiles.getAgentProfile(projectId, pid);
                if (!existing) {
                    return problemJson(c, {status: 404, detail: "Profile not found"});
                }
                const agentKey = patch.agent ?? existing.agent;
                const agent = getAgent(agentKey);
                if (!agent) {
                    return problemJson(c, {status: 400, detail: "Unknown agent"});
                }
                const parsed = agent.profileSchema.safeParse(cfg);
                if (!parsed.success) {
                    return problemJson(c, {
                        status: 400,
                        title: "Invalid profile",
                        detail: parsed.error.message,
                        errors: parsed.error.flatten(),
                    });
                }
                const lengthErrors = validateProfilePromptLengths(parsed.data);
                if (lengthErrors) {
                    return problemJson(c, {
                        status: 400,
                        title: "Invalid profile",
                        detail: "Profile prompts are too long",
                        errors: {fieldErrors: lengthErrors, formErrors: []},
                    });
                }
                cfg = parsed.data;
            }
            const row = await agentProfiles.updateAgentProfile(projectId, pid, {name: patch.name, config: cfg});
            if (!row) {
                return problemJson(c, {status: 404, detail: "Profile not found"});
            }
            events.publish("agent.profile.changed", {
                profileId: row.id,
                agent: row.agent,
                kind: "updated",
                label: row.name,
            });
            return c.json(row, 200);
        } catch (error) {
            log.error("agents:profiles", "update failed", {err: error, projectId, profileId: pid});
            return problemJson(c, {status: 502, detail: "Failed to update profile"});
        }
    },
);

export const deleteProjectAgentProfileHandlers = createHandlers(
    zValidator("param", profileIdParam),
    async (c) => {
        const {projectId, pid} = c.req.valid("param");
        try {
            const events = c.get("events");
            const existing = await agentProfiles.getAgentProfile(projectId, pid);
            if (!existing) {
                return problemJson(c, {status: 404, detail: "Profile not found"});
            }
            await agentProfiles.deleteAgentProfile(projectId, pid);
            events.publish("agent.profile.changed", {
                profileId: existing.id,
                agent: existing.agent,
                kind: "deleted",
                label: existing.name,
            });
            return c.body(null, 204);
        } catch (error) {
            log.error("agents:profiles", "delete failed", {err: error, projectId, profileId: pid});
            return problemJson(c, {status: 502, detail: "Failed to delete profile"});
        }
    },
);
