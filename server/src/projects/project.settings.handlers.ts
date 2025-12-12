import type {ProjectSettings} from "shared";
import {projectTickets, ticketKeys, agentProfilesGlobal, agentProfiles} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {getAgent} from "../agents/registry";

export const getProjectSettingsHandler = async (c: any) => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    const settings = await projects.ensureSettings(projectId);
    return c.json({settings}, 200);
};

export const previewNextTicketKeyHandler = async (c: any) => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    const preview = await projectTickets.previewNextTicketKey(projectId);
    return c.json({preview}, 200);
};

const normalizeNullable = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
    }
    return undefined;
};

export const updateProjectSettingsHandler = async (c: any) => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});

    const body = c.req.valid("json") as {
        baseBranch?: string;
        preferredRemote?: string | null;
        setupScript?: string | null;
        devScript?: string | null;
        cleanupScript?: string | null;
        copyFiles?: string | null;
        allowScriptsToFail?: boolean;
        allowCopyFilesToFail?: boolean;
        allowSetupScriptToFail?: boolean;
        allowDevScriptToFail?: boolean;
        allowCleanupScriptToFail?: boolean;
        defaultAgent?: string | null;
        defaultProfileId?: string | null;
        inlineAgent?: string | null;
        inlineProfileId?: string | null;
        inlineAgentProfileMapping?: import("shared").InlineAgentProfileMapping | null;
        autoCommitOnFinish?: boolean;
        autoPushOnAutocommit?: boolean;
        ticketPrefix?: string;
        githubIssueSyncEnabled?: boolean;
        githubIssueSyncState?: "open" | "all" | "closed";
        githubIssueSyncIntervalMinutes?: number;
        githubIssueAutoCreateEnabled?: boolean;
        autoCloseTicketOnPRMerge?: boolean;
    };
    let {
        defaultAgent,
        defaultProfileId,
        inlineAgent,
        inlineProfileId,
        inlineAgentProfileMapping,
    } = body;

    let agentKey = defaultAgent ?? undefined;
    if (typeof agentKey === "string") {
        agentKey = agentKey.trim() || undefined;
    }

    if (agentKey) {
        const agent = getAgent(agentKey);
        if (!agent) return problemJson(c, {status: 400, detail: "Unknown agent"});
    }

    if (defaultProfileId !== undefined) {
        const profileId =
            typeof defaultProfileId === "string"
                ? defaultProfileId.trim()
                : defaultProfileId;
        if (profileId) {
            const profile =
                await agentProfilesGlobal.getGlobalAgentProfile(profileId);
            if (!profile) {
                return problemJson(c, {
                    status: 400,
                    detail: "Profile not found",
                });
            }
            if (agentKey && profile.agent !== agentKey) {
                return problemJson(c, {
                    status: 400,
                    detail: "Profile does not match selected agent",
                });
            }
            if (!agentKey) {
                agentKey = profile.agent;
            }
        }
    }

    let inlineAgentKey = inlineAgent ?? undefined;
    if (typeof inlineAgentKey === "string") {
        inlineAgentKey = inlineAgentKey.trim() || undefined;
    }

    if (inlineAgentKey) {
        const agent = getAgent(inlineAgentKey);
        if (!agent) {
            return problemJson(c, {
                status: 400,
                detail: "Unknown inline agent",
            });
        }
    }

    if (inlineProfileId !== undefined) {
        const profileId =
            typeof inlineProfileId === "string"
                ? inlineProfileId.trim()
                : inlineProfileId;
        if (profileId) {
            const isGlobal = profileId.startsWith("apg-");
            const profile = isGlobal
                ? await agentProfilesGlobal.getGlobalAgentProfile(profileId)
                : await agentProfiles.getAgentProfile(projectId, profileId);
            if (!profile) {
                return problemJson(c, {
                    status: 400,
                    detail: "Inline profile not found",
                });
            }
            if (inlineAgentKey && profile.agent !== inlineAgentKey) {
                return problemJson(c, {
                    status: 400,
                    detail: "Inline profile does not match selected inline agent",
                });
            }
            if (!inlineAgentKey) {
                inlineAgentKey = profile.agent;
            }
        }
    }

    const updates: Partial<ProjectSettings> = {};

    if (typeof body.baseBranch === "string") {
        updates.baseBranch = body.baseBranch.trim();
    }
    const preferredRemote = normalizeNullable(body.preferredRemote);
    if (preferredRemote !== undefined) updates.preferredRemote = preferredRemote;
    const setupScript = normalizeNullable(body.setupScript);
    if (setupScript !== undefined) updates.setupScript = setupScript;
    const devScript = normalizeNullable(body.devScript);
    if (devScript !== undefined) updates.devScript = devScript;
    const cleanupScript = normalizeNullable(body.cleanupScript);
    if (cleanupScript !== undefined) updates.cleanupScript = cleanupScript;
    const copyFiles = normalizeNullable(body.copyFiles);
    if (copyFiles !== undefined) updates.copyFiles = copyFiles;
    if (body.allowScriptsToFail !== undefined) {
        updates.allowScriptsToFail = body.allowScriptsToFail;
    }
    if (body.allowCopyFilesToFail !== undefined) {
        updates.allowCopyFilesToFail = body.allowCopyFilesToFail;
    }
    if (body.allowSetupScriptToFail !== undefined) {
        updates.allowSetupScriptToFail = body.allowSetupScriptToFail;
    }
    if (body.allowDevScriptToFail !== undefined) {
        updates.allowDevScriptToFail = body.allowDevScriptToFail;
    }
    if (body.allowCleanupScriptToFail !== undefined) {
        updates.allowCleanupScriptToFail = body.allowCleanupScriptToFail;
    }
    if (body.defaultAgent !== undefined) {
        updates.defaultAgent =
            agentKey ?? (body.defaultAgent === null ? null : undefined);
    }
    defaultProfileId = normalizeNullable(body.defaultProfileId);
    if (defaultProfileId !== undefined) {
        updates.defaultProfileId = defaultProfileId;
    }
    if (body.inlineAgent !== undefined) {
        updates.inlineAgent =
            inlineAgentKey ?? (body.inlineAgent === null ? null : undefined);
    }
    inlineProfileId = normalizeNullable(body.inlineProfileId);
    if (inlineProfileId !== undefined) {
        updates.inlineProfileId = inlineProfileId;
    }
    if (inlineAgentProfileMapping !== undefined) {
        updates.inlineAgentProfileMapping =
            inlineAgentProfileMapping ?? {};
    }
    if (body.autoCommitOnFinish !== undefined) {
        updates.autoCommitOnFinish = body.autoCommitOnFinish;
    }
    if (body.autoPushOnAutocommit !== undefined) {
        updates.autoPushOnAutocommit = body.autoPushOnAutocommit;
    }

    if (body.ticketPrefix !== undefined) {
        const sanitized = ticketKeys.sanitizeTicketPrefix(body.ticketPrefix);
        ticketKeys.assertValidTicketPrefix(sanitized);
        updates.ticketPrefix = sanitized;
    }

    if (body.githubIssueSyncEnabled !== undefined) {
        updates.githubIssueSyncEnabled = body.githubIssueSyncEnabled;
    }
    if (body.githubIssueSyncState !== undefined) {
        updates.githubIssueSyncState = body.githubIssueSyncState;
    }
    if (body.githubIssueSyncIntervalMinutes !== undefined) {
        updates.githubIssueSyncIntervalMinutes = body.githubIssueSyncIntervalMinutes;
    }
    if (body.githubIssueAutoCreateEnabled !== undefined) {
        updates.githubIssueAutoCreateEnabled = body.githubIssueAutoCreateEnabled;
    }
    if (body.autoCloseTicketOnPRMerge !== undefined) {
        updates.autoCloseTicketOnPRMerge = body.autoCloseTicketOnPRMerge;
    }

    try {
        const settings = await projects.updateSettings(projectId, updates);
        const events = c.get("events");
        events.publish("project.settings.updated", {
            projectId,
            changes: updates,
            updatedAt: new Date().toISOString(),
        });
        return c.json({settings}, 200);
    } catch (error) {
        log.error("projects:settings", "update failed", {err: error, projectId});
        return problemJson(c, {
            status: 502,
            detail: "Failed to update project settings",
        });
    }
};
