import {Hono} from "hono";
import {z} from "zod";
import {zValidator} from "@hono/zod-validator";
import type {
    CreateProjectRequest,
    UpdateProjectRequest,
    ProjectSettings,
} from "shared";
import type {AppEnv} from "../env";
import {getGitOriginUrl, parseGithubOwnerRepo} from "core";
import {tasks, projectDeps, projectTickets, ticketKeys, attempts, projectsRepo} from "core";
import {agentProfiles, agentProfilesGlobal} from "core";
import {getAgent} from "../agents/registry";
import {importGithubIssues} from "../github/import";
import {listProjectBranches} from "./settings/git";
// ticket preview uses core implementation
const {getCardById, getColumnById} = projectsRepo;
const {
    getBoardState: fetchBoardState,
    createBoardCard,
    updateBoardCard,
    deleteBoardCard,
    moveBoardCard,
    broadcastBoard
} = tasks;

const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    repositoryPath: z.string().min(1, "Repository path is required"),
    initialize: z.boolean().optional(),
    repositorySlug: z.string().min(1).optional().nullable(),
    repositoryUrl: z.url().optional().nullable(),
}) satisfies z.ZodType<CreateProjectRequest>;

const updateProjectSchema = z
    .object({
        name: z.string().min(1, "Project name cannot be empty").optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "No updates provided",
    }) satisfies z.ZodType<UpdateProjectRequest>;

const updateProjectSettingsSchema = z
    .object({
        baseBranch: z.string().min(1).optional(),
        preferredRemote: z.string().optional().nullable(),
        setupScript: z.string().optional().nullable(),
        devScript: z.string().optional().nullable(),
        cleanupScript: z.string().optional().nullable(),
        copyFiles: z.string().optional().nullable(),
        defaultAgent: z.string().optional().nullable(),
        defaultProfileId: z.string().optional().nullable(),
        autoCommitOnFinish: z.boolean().optional(),
        ticketPrefix: z
            .string()
            .min(1, "Ticket prefix cannot be empty")
            .max(6, "Ticket prefix must be at most 6 characters")
            .regex(/^[A-Za-z0-9]+$/, "Ticket prefix must be alphanumeric")
            .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "No updates provided",
    });

const createCardSchema = z.object({
    columnId: z.string().min(1, "Column ID is required"),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    dependsOn: z.array(z.string()).optional(),
});

const updateCardSchema = z
    .object({
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        dependsOn: z.array(z.string()).optional(),
    })
    .refine((data) => data.title !== undefined || data.description !== undefined || data.dependsOn !== undefined, {
        message: "No updates provided",
    });

const moveCardSchema = z.object({
    toColumnId: z.string().min(1, "Target column ID is required"),
    toIndex: z.number().int().min(0),
});

export const createProjectsRouter = () => {
    const router = new Hono<AppEnv>();

    router.get("/", async (c) => {
        const {projects} = c.get("services");
        const result = await projects.list();
        return c.json(result, 200);
    });

    router.post("/", zValidator("json", createProjectSchema), async (c) => {
        const {projects} = c.get("services");
        const events = c.get("events");
        const body = c.req.valid("json");
        const project = await projects.create(body);
        events.publish("project.created", {
            projectId: project.id,
            name: project.name,
            repositoryPath: project.repositoryPath,
            repositoryUrl: project.repositoryUrl,
            repositorySlug: project.repositorySlug,
            createdAt: project.createdAt,
        });
        return c.json(project, 201);
    });

    router.get("/:id", async (c) => {
        const {projects} = c.get("services");
        const project = await projects.get(c.req.param("id"));
        if (!project) return c.json({error: "Project not found"}, 404);
        return c.json(project, 200);
    });

    router.get("/:id/board-state", async (c) => {
        const boardId = c.req.param("id");
        const {projects} = c.get("services");
        const project = await projects.get(boardId);
        if (!project) return c.json({error: "Project not found"}, 404);
        try {
            const state = await fetchBoardState(boardId);
            return c.json({state}, 200);
        } catch (error) {
            console.error('[projects:board-state] failed', error);
            return c.json({error: 'Failed to fetch board state'}, 500);
        }
    });

    router.post(
        "/:id/cards",
        zValidator("json", createCardSchema),
        async (c) => {
            const boardId = c.req.param("id");
            const {projects} = c.get("services");
            const project = await projects.get(boardId);
            if (!project) return c.json({error: "Project not found"}, 404);

            const body = c.req.valid("json");
            const column = await getColumnById(body.columnId);
            if (!column || column.boardId !== boardId) {
                return c.json({error: "Column not found"}, 404);
            }

            try {
                const cardId = await createBoardCard(body.columnId, body.title, body.description ?? undefined, {suppressBroadcast: true});
                if (Array.isArray(body.dependsOn) && body.dependsOn.length > 0) {
                    await projectDeps.setDependencies(cardId, body.dependsOn)
                }
                await broadcastBoard(boardId)
                const state = await fetchBoardState(boardId);
                return c.json({state}, 201);
            } catch (error) {
                console.error('[projects:cards:create] failed', error);
                return c.json({error: 'Failed to create card'}, 500);
            }
        },
    );

    router.patch(
        "/:id/cards/:cardId",
        zValidator("json", updateCardSchema),
        async (c) => {
            const boardId = c.req.param("id");
            const cardId = c.req.param("cardId");
            const {projects} = c.get("services");
            const project = await projects.get(boardId);
            if (!project) return c.json({error: "Project not found"}, 404);

            const card = await getCardById(cardId);
            if (!card) return c.json({error: "Card not found"}, 404);
            let cardBoardId = card.boardId ?? null;
            if (!cardBoardId) {
                const column = await getColumnById(card.columnId);
                cardBoardId = column?.boardId ?? null;
            }
            if (cardBoardId !== boardId) {
                return c.json({error: "Card does not belong to this project"}, 400);
            }

            const body = c.req.valid("json");

            try {
                const hasContentUpdate = body.title !== undefined || body.description !== undefined
                const hasDeps = Array.isArray(body.dependsOn)
                if (hasContentUpdate) {
                    await updateBoardCard(cardId, {
                        title: body.title,
                        description: body.description ?? undefined,
                    }, {suppressBroadcast: hasDeps})
                }
                if (hasDeps) {
                    await projectDeps.setDependencies(cardId, body.dependsOn as string[])
                }
                if (hasContentUpdate || hasDeps) {
                    await broadcastBoard(boardId)
                }
                const state = await fetchBoardState(boardId);
                return c.json({state}, 200);
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Failed to update card'
                console.error('[projects:cards:update] failed', error);
                const status = msg === 'dependency_board_mismatch' || msg === 'dependency_cycle' ? 400 : 500
                return c.json({error: msg}, status);
            }
        },
    );

    router.post(
        "/:id/cards/:cardId/move",
        zValidator("json", moveCardSchema),
        async (c) => {
            const boardId = c.req.param("id");
            const cardId = c.req.param("cardId");
            const {projects} = c.get("services");
            const project = await projects.get(boardId);
            if (!project) return c.json({error: "Project not found"}, 404);

            const card = await getCardById(cardId);
            if (!card) return c.json({error: "Card not found"}, 404);
            let cardBoardId = card.boardId ?? null;
            if (!cardBoardId) {
                const column = await getColumnById(card.columnId);
                cardBoardId = column?.boardId ?? null;
            }
            if (cardBoardId !== boardId) {
                return c.json({error: "Card does not belong to this project"}, 400);
            }

            const body = c.req.valid("json");
            const targetColumn = await getColumnById(body.toColumnId);
            if (!targetColumn || targetColumn.boardId !== boardId) {
                return c.json({error: "Target column not found"}, 404);
            }

            // Prevent moving blocked cards into In Progress
            if ((targetColumn.title || '').trim().toLowerCase() === 'in progress') {
                const {blocked} = await projectDeps.isCardBlocked(cardId)
                if (blocked) {
                    return c.json({error: 'Task is blocked by dependencies'}, 409)
                }
            }

            try {
                await moveBoardCard(cardId, body.toColumnId, body.toIndex);
                const state = await fetchBoardState(boardId);
                return c.json({state}, 200);
            } catch (error) {
                console.error('[projects:cards:move] failed', error);
                return c.json({error: 'Failed to move card'}, 500);
            }
        },
    );

    router.delete("/:id/cards/:cardId", async (c) => {
        const boardId = c.req.param("id");
        const cardId = c.req.param("cardId");
        const {projects} = c.get("services");
        const project = await projects.get(boardId);
        if (!project) return c.json({error: "Project not found"}, 404);

        const card = await getCardById(cardId);
        if (!card) return c.json({error: "Card not found"}, 404);
        let cardBoardId = card.boardId ?? null;
        if (!cardBoardId) {
            const column = await getColumnById(card.columnId);
            cardBoardId = column?.boardId ?? null;
        }
        if (cardBoardId !== boardId) {
            return c.json({error: "Card does not belong to this project"}, 400);
        }

        try {
            await deleteBoardCard(cardId);
            const state = await fetchBoardState(boardId);
            return c.json({state}, 200);
        } catch (error) {
            console.error('[projects:cards:delete] failed', error);
            return c.json({error: 'Failed to delete card'}, 500);
        }
    });

    router.get("/:id/settings", async (c) => {
        const {projects} = c.get("services");
        const projectId = c.req.param("id");
        const project = await projects.get(projectId);
        if (!project) return c.json({error: "Project not found"}, 404);
        const settings = await projects.ensureSettings(projectId);
        return c.json({settings}, 200);
    });

    router.get("/:id/tickets/next-key", async (c) => {
        const {projects} = c.get("services");
        const projectId = c.req.param("id");
        const project = await projects.get(projectId);
        if (!project) return c.json({error: "Project not found"}, 404);
        const preview = await projectTickets.previewNextTicketKey(projectId);
        return c.json({preview}, 200);
    });

    router.patch(
        "/:id/settings",
        zValidator("json", updateProjectSettingsSchema),
        async (c) => {
            const {projects} = c.get("services");
            const projectId = c.req.param("id");
            const project = await projects.get(projectId);
            if (!project) return c.json({error: "Project not found"}, 404);

            const body = c.req.valid("json");
            let {defaultAgent, defaultProfileId} = body as {
                defaultAgent?: string | null;
                defaultProfileId?: string | null;
            };

            let agentKey = defaultAgent ?? undefined;
            if (typeof agentKey === "string") {
                agentKey = agentKey.trim() || undefined;
            }

            if (agentKey) {
                const agent = getAgent(agentKey);
                if (!agent) return c.json({error: "Unknown agent"}, 400);
            }

            if (defaultProfileId !== undefined) {
                const profileId =
                    typeof defaultProfileId === "string"
                        ? defaultProfileId.trim()
                        : defaultProfileId;
                if (profileId) {
                    const profile = await agentProfilesGlobal.getGlobalAgentProfile(profileId);
                    if (!profile) return c.json({error: "Profile not found"}, 400);
                    if (agentKey && profile.agent !== agentKey) {
                        return c.json(
                            {error: "Profile does not match selected agent"},
                            400
                        );
                    }
                    if (!agentKey) {
                        agentKey = profile.agent;
                    }
                }
            }

            const normalizeNullable = (value: unknown): string | null | undefined => {
                if (value === undefined) return undefined;
                if (value === null) return null;
                if (typeof value === "string") {
                    const trimmed = value.trim();
                    return trimmed.length ? trimmed : null;
                }
                return undefined;
            };

            const updates: Partial<ProjectSettings> = {};

            if (typeof body.baseBranch === "string")
                updates.baseBranch = body.baseBranch.trim();
            const preferredRemote = normalizeNullable(body.preferredRemote);
            if (preferredRemote !== undefined)
                updates.preferredRemote = preferredRemote;
            const setupScript = normalizeNullable(body.setupScript);
            if (setupScript !== undefined) updates.setupScript = setupScript;
            const devScript = normalizeNullable(body.devScript);
            if (devScript !== undefined) updates.devScript = devScript;
            const cleanupScript = normalizeNullable(body.cleanupScript);
            if (cleanupScript !== undefined) updates.cleanupScript = cleanupScript;
            const copyFiles = normalizeNullable(body.copyFiles);
            if (copyFiles !== undefined) updates.copyFiles = copyFiles;
            if (body.defaultAgent !== undefined)
                updates.defaultAgent =
                    agentKey ?? (body.defaultAgent === null ? null : undefined);
            defaultProfileId = normalizeNullable(body.defaultProfileId);
            if (defaultProfileId !== undefined)
                updates.defaultProfileId = defaultProfileId;
            if (body.autoCommitOnFinish !== undefined)
                updates.autoCommitOnFinish = body.autoCommitOnFinish;

            if (body.ticketPrefix !== undefined) {
                const sanitized = ticketKeys.sanitizeTicketPrefix(body.ticketPrefix);
                ticketKeys.assertValidTicketPrefix(sanitized);
                updates.ticketPrefix = sanitized;
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
                console.error("[projects:settings:update] failed", error);
                return c.json({error: "Failed to update project settings"}, 500);
            }
        }
    );

    router.get("/:id/git/branches", async (c) => {
        const {projects} = c.get("services");
        const projectId = c.req.param("id");
        const project = await projects.get(projectId);
        if (!project) return c.json({error: "Project not found"}, 404);
        try {
            const branches = await listProjectBranches(projectId);
            return c.json({branches}, 200);
        } catch (error) {
            console.error("[projects:branches] failed", error);
            return c.json({error: "Failed to list branches"}, 500);
        }
    });

    router.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
        const {projects} = c.get("services");
        const events = c.get("events");
        const body = c.req.valid("json");
        const project = await projects.update(c.req.param("id"), body);
        if (!project) return c.json({error: "Project not found"}, 404);
        events.publish("project.updated", {
            projectId: project.id,
            changes: body,
            updatedAt: new Date().toISOString(),
        });
        return c.json(project, 200);
    });

    router.delete("/:id", async (c) => {
        const {projects} = c.get("services");
        const events = c.get("events");
        const projectId = c.req.param("id");
        const project = await projects.get(projectId);
        if (!project) return c.json({error: "Project not found"}, 404);
        const removed = await projects.remove(projectId);
        if (!removed) return c.json({error: "Project not found"}, 404);
        events.publish("project.deleted", {projectId, projectName: project.name});
        return c.body(null, 204);
    });

    // Detect GitHub origin for this project by reading the repo's remote
    router.get("/:id/github/origin", async (c) => {
        const {projects} = c.get("services");
        const project = await projects.get(c.req.param("id"));
        if (!project) return c.json({error: "Project not found"}, 404);
        const originUrl = await getGitOriginUrl(project.repositoryPath);
        const parsed = originUrl ? parseGithubOwnerRepo(originUrl) : null;
        return c.json(
            {
                originUrl: originUrl ?? null,
                owner: parsed?.owner ?? null,
                repo: parsed?.repo ?? null,
            },
            200
        );
    });

    // Start an attempt for a card within this project
    router.post(
        "/:id/cards/:cardId/attempts",
        zValidator(
            "json",
            z.object({
                agent: z.enum(["ECHO", "SHELL", "CODEX", "OPENCODE", "DROID"]),
                profileId: z.string().optional(),
                baseBranch: z.string().min(1).optional(),
                branchName: z.string().min(1).optional(),
            })
        ),
        async (c) => {
            const body = c.req.valid("json");
            try {
                // Disallow starting attempts for tasks already in Done
                const card = await getCardById(c.req.param("cardId"));
                if (!card) return c.json({error: "Card not found"}, 404);
                const column = await getColumnById(card.columnId);
                if (column?.title === "Done")
                    return c.json({error: "Task is done and locked"}, 409);

                const events = c.get("events")
                const attempt = await attempts.startAttempt(
                    {
                        boardId: c.req.param("id"),
                        cardId: c.req.param("cardId"),
                        agent: body.agent,
                        profileId: body.profileId,
                        baseBranch: body.baseBranch,
                        branchName: body.branchName,
                    },
                    {events},
                );
                return c.json(attempt, 201);
            } catch (error) {
                console.error("[attempts:start] failed", error);
                return c.json(
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : "Failed to start attempt",
                    },
                    500
                );
            }
        }
    );

    // Agent profiles CRUD (validate using the agent's schema)
    router.get("/:id/agents/profiles", async (c) => {
        try {
            const rows = await agentProfiles.listAgentProfiles(c.req.param("id"));
            return c.json({profiles: rows}, 200);
        } catch (error) {
            console.error("[agents:profiles:list] failed", error);
            return c.json({error: "Failed to list profiles"}, 500);
        }
    });

    router.post(
        "/:id/agents/profiles",
        zValidator(
            "json",
            z.object({agent: z.string(), name: z.string().min(1), config: z.any()})
        ),
        async (c) => {
            const {agent: agentKey, name, config} = c.req.valid("json") as any;
            try {
                const events = c.get("events");
                const agent = getAgent(agentKey);
                if (!agent) return c.json({error: "Unknown agent"}, 400);
                const parsed = agent.profileSchema.safeParse(config);
                if (!parsed.success)
                    return c.json(
                        {error: "Invalid profile", details: parsed.error.flatten()},
                        400
                    );
                const row = await agentProfiles.createAgentProfile(
                    c.req.param("id"),
                    agentKey,
                    name,
                    parsed.data
                );
                events.publish("agent.profile.changed", {
                    profileId: row.id,
                    agent: row.agent,
                    kind: "created",
                    label: row.name,
                });
                return c.json(row, 201);
            } catch (error) {
                console.error("[agents:profiles:create] failed", error);
                return c.json({error: "Failed to create profile"}, 500);
            }
        }
    );

    router.get("/:id/agents/profiles/:pid", async (c) => {
        try {
            const row = await agentProfiles.getAgentProfile(c.req.param("id"), c.req.param("pid"));
            if (!row) return c.json({error: "Not found"}, 404);
            return c.json(row, 200);
        } catch (error) {
            console.error("[agents:profiles:get] failed", error);
            return c.json({error: "Failed to fetch profile"}, 500);
        }
    });

    router.patch(
        "/:id/agents/profiles/:pid",
        zValidator(
            "json",
            z.object({
                name: z.string().min(1).optional(),
                config: z.any().optional(),
                agent: z.string().optional(),
            })
        ),
        async (c) => {
            const patch = c.req.valid("json") as any;
            try {
                const events = c.get("events");
                let cfg = patch.config;
                if (cfg !== undefined) {
                    const existing = await agentProfiles.getAgentProfile(
                        c.req.param("id"),
                        c.req.param("pid")
                    );
                    if (!existing) return c.json({error: "Not found"}, 404);
                    const agentKey = patch.agent ?? existing.agent;
                    const agent = getAgent(agentKey);
                    if (!agent) return c.json({error: "Unknown agent"}, 400);
                    const parsed = agent.profileSchema.safeParse(cfg);
                    if (!parsed.success)
                        return c.json(
                            {error: "Invalid profile", details: parsed.error.flatten()},
                            400
                        );
                    cfg = parsed.data;
                }
                const row = await agentProfiles.updateAgentProfile(
                    c.req.param("id"),
                    c.req.param("pid"),
                    {name: patch.name, config: cfg}
                );
                if (!row) return c.json({error: "Not found"}, 404);
                events.publish("agent.profile.changed", {
                    profileId: row.id,
                    agent: row.agent,
                    kind: "updated",
                    label: row.name,
                });
                return c.json(row, 200);
            } catch (error) {
                console.error("[agents:profiles:update] failed", error);
                return c.json({error: "Failed to update profile"}, 500);
            }
        }
    );

    router.delete("/:id/agents/profiles/:pid", async (c) => {
        try {
            const events = c.get("events");
            const existing = await agentProfiles.getAgentProfile(c.req.param("id"), c.req.param("pid"));
            if (!existing) return c.json({error: "Not found"}, 404);
            await agentProfiles.deleteAgentProfile(c.req.param("id"), c.req.param("pid"));
            events.publish("agent.profile.changed", {
                profileId: existing.id,
                agent: existing.agent,
                kind: "deleted",
                label: existing.name,
            });
            return c.body(null, 204);
        } catch (error) {
            console.error("[agents:profiles:delete] failed", error);
            return c.json({error: "Failed to delete profile"}, 500);
        }
    });

    router.get("/:id/cards/:cardId/attempt", async (c) => {
        try {
            const data = await attempts.getLatestAttemptForCard(
                c.req.param("id"),
                c.req.param("cardId")
            );
            if (!data) return c.json({error: "Not found"}, 404);
            return c.json(data, 200);
        } catch (error) {
            console.error("[attempts:attempt] failed", error);
            return c.json(
                {
                    error:
                        error instanceof Error ? error.message : "Failed to fetch attempt",
                },
                500
            );
        }
    });

    // Import GitHub issues into this project's board
    router.post(
        "/:id/import/github/issues",
        zValidator(
            "json",
            z.object({
                owner: z.string().min(1),
                repo: z.string().min(1),
                state: z.enum(["open", "closed", "all"]).optional(),
            })
        ),
        async (c) => {
            const boardId = c.req.param("id");
            const {owner, repo, state} = c.req.valid("json");
            try {
                const events = c.get("events");
                const result = await importGithubIssues({
                    boardId,
                    owner,
                    repo,
                    state,
                }, {bus: events});
                return c.json(result, 200);
            } catch (error) {
                console.error("[projects:import:github] failed", error);
                return c.json(
                    {
                        error:
                            error instanceof Error ? error.message : "GitHub import failed",
                    },
                    500
                );
            }
        }
    );

    return router;
};
