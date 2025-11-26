import {agentProfiles} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {getAgent} from "../agents/registry";

export const listProjectAgentProfilesHandler = async (c: any) => {
    try {
        const rows = await agentProfiles.listAgentProfiles(c.req.param("projectId"));
        return c.json({profiles: rows}, 200);
    } catch (error) {
        log.error(
            {err: error, projectId: c.req.param("projectId")},
            "[agents:profiles:list] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to list profiles",
        });
    }
};

export const createProjectAgentProfileHandler = async (c: any) => {
    const {agent: agentKey, name, config} = c.req.valid("json") as any;
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
        const row = await agentProfiles.createAgentProfile(
            c.req.param("projectId"),
            agentKey,
            name,
            parsed.data,
        );
        events.publish("agent.profile.changed", {
            profileId: row.id,
            agent: row.agent,
            kind: "created",
            label: row.name,
        });
        return c.json(row, 201);
    } catch (error) {
        log.error(
            {
                err: error,
                projectId: c.req.param("projectId"),
                agent: agentKey,
                name,
            },
            "[agents:profiles:create] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to create profile",
        });
    }
};

export const getProjectAgentProfileHandler = async (c: any) => {
    try {
        const row = await agentProfiles.getAgentProfile(
            c.req.param("projectId"),
            c.req.param("pid"),
        );
        if (!row) {
            return problemJson(c, {status: 404, detail: "Profile not found"});
        }
        return c.json(row, 200);
    } catch (error) {
        log.error(
            {
                err: error,
                projectId: c.req.param("projectId"),
                profileId: c.req.param("pid"),
            },
            "[agents:profiles:get] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to fetch profile",
        });
    }
};

export const updateProjectAgentProfileHandler = async (c: any) => {
    const patch = c.req.valid("json") as any;
    try {
        const events = c.get("events");
        let cfg = patch.config;
        if (cfg !== undefined) {
            const existing = await agentProfiles.getAgentProfile(
                c.req.param("projectId"),
                c.req.param("pid"),
            );
            if (!existing) {
                return problemJson(c, {
                    status: 404,
                    detail: "Profile not found",
                });
            }
            const agentKey = patch.agent ?? existing.agent;
            const agent = getAgent(agentKey);
            if (!agent) {
                return problemJson(c, {
                    status: 400,
                    detail: "Unknown agent",
                });
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
            cfg = parsed.data;
        }
        const row = await agentProfiles.updateAgentProfile(
            c.req.param("projectId"),
            c.req.param("pid"),
            {name: patch.name, config: cfg},
        );
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
        log.error(
            {
                err: error,
                projectId: c.req.param("projectId"),
                profileId: c.req.param("pid"),
            },
            "[agents:profiles:update] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to update profile",
        });
    }
};

export const deleteProjectAgentProfileHandler = async (c: any) => {
    try {
        const events = c.get("events");
        const existing = await agentProfiles.getAgentProfile(
            c.req.param("projectId"),
            c.req.param("pid"),
        );
        if (!existing) {
            return problemJson(c, {status: 404, detail: "Profile not found"});
        }
        await agentProfiles.deleteAgentProfile(
            c.req.param("projectId"),
            c.req.param("pid"),
        );
        events.publish("agent.profile.changed", {
            profileId: existing.id,
            agent: existing.agent,
            kind: "deleted",
            label: existing.name,
        });
        return c.body(null, 204);
    } catch (error) {
        log.error(
            {
                err: error,
                projectId: c.req.param("projectId"),
                profileId: c.req.param("pid"),
            },
            "[agents:profiles:delete] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to delete profile",
        });
    }
};
