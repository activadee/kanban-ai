import {Hono} from "hono";
import {z} from "zod";
import {zValidator} from "@hono/zod-validator";
import type {
    CreateProjectRequest,
    UpdateProjectRequest,
    ProjectSettings,
    ProjectSummary,
} from "shared";
import type {AppEnv} from "../env";
import {getGitOriginUrl, parseGithubOwnerRepo} from "core";
import {tasks, projectDeps, projectTickets, ticketKeys, attempts, projectsRepo} from "core";
import {agentProfiles, agentProfilesGlobal} from "core";
import {getAgent} from "../agents/registry";
import {importGithubIssues} from "../github/import.service";
import {listProjectBranches} from "./settings/git";
import {problemJson} from "../http/problem";
import {log} from '../log'
import {startAttemptSchema} from '../attempts/attempts.schemas'
// ticket preview uses core implementation
const {getCardById, getColumnById, listCardsForColumns} = projectsRepo;
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
        autoPushOnAutocommit: z.boolean().optional(),
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
        columnId: z.string().min(1, "Column ID is required").optional(),
        index: z.number().int().min(0).optional(),
    })
    .superRefine((data, ctx) => {
        const hasContent = data.title !== undefined || data.description !== undefined || data.dependsOn !== undefined
        const wantsMove = data.columnId !== undefined || data.index !== undefined

        if (wantsMove && (data.columnId === undefined || data.index === undefined)) {
            ctx.addIssue({code: z.ZodIssueCode.custom, message: 'columnId and index are required to move a card'})
        }

        if (!hasContent && !wantsMove) {
            ctx.addIssue({code: z.ZodIssueCode.custom, message: 'No updates provided'})
        }
    });

type BoardContext = { boardId: string; project: ProjectSummary }

const resolveBoardForProject = async (c: any): Promise<BoardContext | null> => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return null;
    return {boardId: project.boardId ?? project.id, project};
};

const resolveBoardById = async (c: any): Promise<BoardContext | null> => {
    const {projects} = c.get("services");
    const boardId = c.req.param("boardId");
    const project = await projects.get(boardId);
    if (!project) return null;
    return {boardId: project.boardId ?? project.id, project};
};

function createBoardRouter(resolveBoard: (c: any) => Promise<BoardContext | null>) {
    const boardRouter = new Hono<AppEnv>();

    const loadContext = async (c: any): Promise<BoardContext | Response> => {
        const ctx = await resolveBoard(c);
        if (!ctx) return problemJson(c, {status: 404, detail: "Board not found"});
        return ctx;
    };

    boardRouter.get('/', async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        try {
            const state = await fetchBoardState(ctx.boardId);
            return c.json({state}, 200);
        } catch (error) {
            log.error({err: error, boardId: ctx.boardId}, '[board:state] failed');
            return problemJson(c, {status: 502, detail: 'Failed to fetch board state'});
        }
    });

    boardRouter.post(
        "/cards",
        zValidator("json", createCardSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            const {boardId, project} = ctx;

            const body = c.req.valid("json");
            const column = await getColumnById(body.columnId);
            if (!column || column.boardId !== boardId) {
                return problemJson(c, {status: 404, detail: "Column not found"});
            }

            try {
                const cardId = await createBoardCard(body.columnId, body.title, body.description ?? undefined, {suppressBroadcast: true});
                if (Array.isArray(body.dependsOn) && body.dependsOn.length > 0) {
                    await projectDeps.setDependencies(cardId, body.dependsOn);
                }
                await broadcastBoard(boardId);
                const state = await fetchBoardState(boardId);
                return c.json({state}, 201);
            } catch (error) {
                log.error({err: error, boardId, projectId: project.id}, '[board:cards:create] failed');
                return problemJson(c, {status: 502, detail: 'Failed to create card'});
            }
        },
    );

    boardRouter.patch(
        "/cards/:cardId",
        zValidator("json", updateCardSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            const {boardId, project} = ctx;
            const cardId = c.req.param("cardId");

            const card = await getCardById(cardId);
            if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
            let cardBoardId = card.boardId ?? null;
            if (!cardBoardId) {
                const column = await getColumnById(card.columnId);
                cardBoardId = column?.boardId ?? null;
            }
            if (cardBoardId !== boardId) {
                return problemJson(c, {status: 400, detail: "Card does not belong to this board"});
            }

            const body = c.req.valid("json");
            const wantsMove = body.columnId !== undefined || body.index !== undefined;
            const hasContentUpdate = body.title !== undefined || body.description !== undefined;
            const hasDeps = Array.isArray(body.dependsOn);
            const suppressBroadcast = wantsMove || hasDeps;

            if (wantsMove) {
                const targetColumn = await getColumnById(body.columnId!);
                if (!targetColumn || targetColumn.boardId !== boardId) {
                    return problemJson(c, {status: 404, detail: "Target column not found"});
                }

                // Prevent moving blocked cards into In Progress
                if ((targetColumn.title || '').trim().toLowerCase() === 'in progress') {
                    const {blocked} = await projectDeps.isCardBlocked(cardId);
                    if (blocked) {
                        return problemJson(c, {status: 409, detail: 'Task is blocked by dependencies'});
                    }
                }
            }

            try {
                if (hasContentUpdate) {
                    await updateBoardCard(cardId, {
                        title: body.title,
                        description: body.description ?? undefined,
                    }, {suppressBroadcast});
                }

                if (hasDeps) {
                    await projectDeps.setDependencies(cardId, body.dependsOn as string[]);
                }

                if (wantsMove) {
                    const targetIndex = body.index as number;
                    await moveBoardCard(cardId, body.columnId!, targetIndex);

                    const toIso = (value: Date | string | number | null | undefined) => {
                        if (!value) return new Date().toISOString();
                        if (value instanceof Date) return value.toISOString();
                        const date = new Date(value);
                        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
                    };

                    const updatedCard = await getCardById(cardId);
                    if (!updatedCard) return problemJson(c, {status: 404, detail: "Card not found"});

                    let deps: string[] = [];
                    try {
                        deps = await projectDeps.listDependencies(cardId);
                    } catch {
                        deps = [];
                    }

                    const columnIds = Array.from(new Set([card.columnId, body.columnId!]));
                    const columnRows = await Promise.all(columnIds.map((id) => getColumnById(id)));
                    const columnCards = new Map<string, string[]>(columnIds.map((id) => [id, []]));
                    const cardRows = await listCardsForColumns(columnIds);
                    for (const row of cardRows) {
                        const list = columnCards.get(row.columnId);
                        if (!list) continue;
                        list.push(row.id);
                    }

                    const columnsPayload: Record<string, { id: string; title: string; cardIds: string[] }> = {};
                    for (const col of columnRows) {
                        if (!col) continue;
                        columnsPayload[col.id] = {
                            id: col.id,
                            title: col.title,
                            cardIds: columnCards.get(col.id) ?? [],
                        };
                    }

                    const cardPayload = {
                        id: updatedCard.id,
                        ticketKey: updatedCard.ticketKey ?? undefined,
                        prUrl: updatedCard.prUrl ?? undefined,
                        title: updatedCard.title,
                        description: updatedCard.description ?? undefined,
                        dependsOn: deps.length ? deps : undefined,
                        createdAt: toIso(updatedCard.createdAt),
                        updatedAt: toIso(updatedCard.updatedAt),
                    };

                    return c.json({card: cardPayload, columns: columnsPayload}, 200);
                }

                if (hasDeps) {
                    await broadcastBoard(boardId);
                }
                const state = await fetchBoardState(boardId);
                return c.json({state}, 200);
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Failed to update card';
                log.error({err: error, boardId, cardId}, '[board:cards:update] failed');
                const status = msg === 'dependency_board_mismatch' || msg === 'dependency_cycle' ? 400 : 502;
                return problemJson(c, {status, detail: msg});
            }
        },
    );

    boardRouter.delete("/cards/:cardId", async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        const {boardId} = ctx;
        const cardId = c.req.param("cardId");

        const card = await getCardById(cardId);
        if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
        let cardBoardId = card.boardId ?? null;
        if (!cardBoardId) {
            const column = await getColumnById(card.columnId);
            cardBoardId = column?.boardId ?? null;
        }
        if (cardBoardId !== boardId) {
            return problemJson(c, {status: 400, detail: "Card does not belong to this board"});
        }

        try {
            await deleteBoardCard(cardId);
            await broadcastBoard(boardId);
            return c.body(null, 204);
        } catch (error) {
            log.error({err: error, boardId, cardId}, '[board:cards:delete] failed');
            return problemJson(c, {status: 502, detail: 'Failed to delete card'});
        }
    });

    boardRouter.get("/cards/:cardId/attempt", async (c) => {
        const ctx = await loadContext(c);
        if (ctx instanceof Response) return ctx;
        const {boardId} = ctx;
        try {
            const data = await attempts.getLatestAttemptForCard(boardId, c.req.param("cardId"));
            if (!data) return problemJson(c, {status: 404, detail: "Attempt not found"});
            return c.json(data, 200);
        } catch (error) {
            log.error({err: error, boardId, cardId: c.req.param("cardId")}, "[attempts:attempt] failed");
            return problemJson(c, {
                status: 502,
                detail: error instanceof Error ? error.message : "Failed to fetch attempt",
            });
        }
    });

    // Start an attempt for a card within this board
    boardRouter.post(
        "/cards/:cardId/attempts",
        zValidator("json", startAttemptSchema),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            const {boardId, project} = ctx;
            const body = c.req.valid("json");
            try {
                // Disallow starting attempts for tasks already in Done/blocked
                const card = await getCardById(c.req.param("cardId"));
                if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
                const column = await getColumnById(card.columnId);
                const colTitle = (column?.title || "").trim().toLowerCase();
                if (colTitle === "done")
                    return problemJson(c, {status: 409, detail: "Task is done and locked"});
                try {
                    const {blocked} = await projectDeps.isCardBlocked(card.id);
                    if (blocked) return problemJson(c, {status: 409, detail: "Task is blocked by dependencies"});
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
                c.header("Deprecation", "true");
                c.header(
                    "Link",
                    `</api/v1/projects/${project.id}/cards/${c.req.param("cardId")}/attempts>; rel="successor-version"`,
                );
                return c.json(attempt, 201);
            } catch (error) {
                log.error(
                    {
                        err: error,
                        boardId,
                        cardId: c.req.param("cardId"),
                        agent: body.agent,
                        profileId: body.profileId,
                    },
                    "[attempts:start] failed",
                );
                return problemJson(c, {
                    status: 502,
                    detail:
                        error instanceof Error
                            ? error.message
                            : "Failed to start attempt",
                });
            }
        }
    );

    // Import GitHub issues into this board
    boardRouter.post(
        "/import/github/issues",
        zValidator(
            "json",
            z.object({
                owner: z.string().min(1),
                repo: z.string().min(1),
                state: z.enum(["open", "closed", "all"]).optional(),
            })
        ),
        async (c) => {
            const ctx = await loadContext(c);
            if (ctx instanceof Response) return ctx;
            const {boardId} = ctx;
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
                log.error({err: error, boardId, owner, repo, state}, "[board:import:github] failed");
                const detail = error instanceof Error ? error.message : "GitHub import failed";
                const status = detail.toLowerCase().includes('github') ? 502 : 500;
                return problemJson(c, {status, detail});
            }
        }
    );

    return boardRouter;
}

export const createProjectsRouter = () => {
    const router = new Hono<AppEnv>();

    const loadProjectBoard = async (c: any): Promise<BoardContext | Response> => {
        const ctx = await resolveBoardForProject(c);
        if (!ctx) return problemJson(c, {status: 404, detail: "Project not found"});
        return ctx;
    };

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

    router.get("/:projectId", async (c) => {
        const {projects} = c.get("services");
        const project = await projects.get(c.req.param("projectId"));
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
        return c.json(project, 200);
    });

    router.get("/:projectId/cards/:cardId/attempt", async (c) => {
        const ctx = await loadProjectBoard(c);
        if (ctx instanceof Response) return ctx;
        const {boardId} = ctx;
        try {
            const data = await attempts.getLatestAttemptForCard(boardId, c.req.param("cardId"));
            if (!data) return problemJson(c, {status: 404, detail: "Attempt not found"});
            return c.json(data, 200);
        } catch (error) {
            log.error({err: error, boardId, cardId: c.req.param("cardId")}, "[attempts:attempt] failed");
            return problemJson(c, {
                status: 502,
                detail: error instanceof Error ? error.message : "Failed to fetch attempt",
            });
        }
    });

    router.post(
        "/:projectId/cards/:cardId/attempts",
        zValidator("json", startAttemptSchema),
        async (c) => {
            const ctx = await loadProjectBoard(c);
            if (ctx instanceof Response) return ctx;
            const {boardId} = ctx;
            const body = c.req.valid("json");
            try {
                const card = await getCardById(c.req.param("cardId"));
                if (!card) return problemJson(c, {status: 404, detail: "Card not found"});
                if (card.boardId && card.boardId !== boardId)
                    return problemJson(c, {status: 400, detail: "Card does not belong to this project"});
                const column = await getColumnById(card.columnId);
                const colTitle = (column?.title || "").trim().toLowerCase();
                if (colTitle === "done") return problemJson(c, {status: 409, detail: "Task is done and locked"});
                try {
                    const {blocked} = await projectDeps.isCardBlocked(card.id);
                    if (blocked) return problemJson(c, {status: 409, detail: "Task is blocked by dependencies"});
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
                return c.json(attempt, 201);
            } catch (error) {
                log.error(
                    {
                        err: error,
                        boardId,
                        cardId: c.req.param("cardId"),
                        agent: body.agent,
                        profileId: body.profileId,
                    },
                    "[attempts:start:project] failed",
                );
                return problemJson(c, {
                    status: 502,
                    detail: error instanceof Error ? error.message : "Failed to start attempt",
                });
            }
        },
    );

    router.route("/:projectId/board", createBoardRouter(resolveBoardForProject));

    router.get("/:projectId/settings", async (c) => {
        const {projects} = c.get("services");
        const projectId = c.req.param("projectId");
        const project = await projects.get(projectId);
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
        const settings = await projects.ensureSettings(projectId);
        return c.json({settings}, 200);
    });

    router.get("/:projectId/tickets/next-key", async (c) => {
        const {projects} = c.get("services");
        const projectId = c.req.param("projectId");
        const project = await projects.get(projectId);
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
        const preview = await projectTickets.previewNextTicketKey(projectId);
        return c.json({preview}, 200);
    });

    router.patch(
        "/:projectId/settings",
        zValidator("json", updateProjectSettingsSchema),
        async (c) => {
            const {projects} = c.get("services");
            const projectId = c.req.param("projectId");
            const project = await projects.get(projectId);
            if (!project) return problemJson(c, {status: 404, detail: "Project not found"});

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
                if (!agent) return problemJson(c, {status: 400, detail: "Unknown agent"});
            }

            if (defaultProfileId !== undefined) {
                const profileId =
                    typeof defaultProfileId === "string"
                        ? defaultProfileId.trim()
                        : defaultProfileId;
                if (profileId) {
                    const profile = await agentProfilesGlobal.getGlobalAgentProfile(profileId);
                    if (!profile) return problemJson(c, {status: 400, detail: "Profile not found"});
                    if (agentKey && profile.agent !== agentKey) {
                        return problemJson(
                            c,
                            {status: 400, detail: "Profile does not match selected agent"},
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
            if (body.autoPushOnAutocommit !== undefined)
                updates.autoPushOnAutocommit = body.autoPushOnAutocommit;

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
                log.error({err: error, projectId}, "[projects:settings:update] failed");
                return problemJson(c, {status: 502, detail: "Failed to update project settings"});
            }
        }
    );

    router.get("/:projectId/git/branches", async (c) => {
        const {projects} = c.get("services");
        const projectId = c.req.param("projectId");
        const project = await projects.get(projectId);
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
        try {
            const branches = await listProjectBranches(projectId);
            return c.json({branches}, 200);
        } catch (error) {
            log.error({err: error, projectId}, "[projects:branches] failed");
            return problemJson(c, {status: 502, detail: "Failed to list branches"});
        }
    });

    router.patch("/:projectId", zValidator("json", updateProjectSchema), async (c) => {
        const {projects} = c.get("services");
        const events = c.get("events");
        const body = c.req.valid("json");
        const project = await projects.update(c.req.param("projectId"), body);
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
        events.publish("project.updated", {
            projectId: project.id,
            changes: body,
            updatedAt: new Date().toISOString(),
        });
        return c.json(project, 200);
    });

    router.delete("/:projectId", async (c) => {
        const {projects} = c.get("services");
        const events = c.get("events");
        const projectId = c.req.param("projectId");
        const project = await projects.get(projectId);
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
        const removed = await projects.remove(projectId);
        if (!removed) return problemJson(c, {status: 404, detail: "Project not found"});
        events.publish("project.deleted", {
            projectId,
            projectName: project.name,
            repositoryPath: project.repositoryPath,
        });
        return c.body(null, 204);
    });

    // Detect GitHub origin for this project by reading the repo's remote
    router.get("/:projectId/github/origin", async (c) => {
        const {projects} = c.get("services");
        const project = await projects.get(c.req.param("projectId"));
        if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
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

    // Agent profiles CRUD (validate using the agent's schema)
    router.get("/:projectId/agents/profiles", async (c) => {
        try {
            const rows = await agentProfiles.listAgentProfiles(c.req.param("projectId"));
            return c.json({profiles: rows}, 200);
        } catch (error) {
            log.error({err: error, projectId: c.req.param("projectId")}, "[agents:profiles:list] failed");
            return problemJson(c, {status: 502, detail: "Failed to list profiles"});
        }
    });

    router.post(
        "/:projectId/agents/profiles",
        zValidator(
            "json",
            z.object({agent: z.string(), name: z.string().min(1), config: z.any()})
        ),
        async (c) => {
            const {agent: agentKey, name, config} = c.req.valid("json") as any;
            try {
                const events = c.get("events");
                const agent = getAgent(agentKey);
                if (!agent) return problemJson(c, {status: 400, detail: "Unknown agent"});
                const parsed = agent.profileSchema.safeParse(config);
                if (!parsed.success)
                    return problemJson(
                        c,
                        {status: 400, title: "Invalid profile", detail: parsed.error.message, errors: parsed.error.flatten()},
                    );
                const row = await agentProfiles.createAgentProfile(
                    c.req.param("projectId"),
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
                log.error(
                    {err: error, projectId: c.req.param("projectId"), agent: agentKey, name},
                    "[agents:profiles:create] failed",
                );
                return problemJson(c, {status: 502, detail: "Failed to create profile"});
            }
        }
    );

    router.get("/:projectId/agents/profiles/:pid", async (c) => {
        try {
            const row = await agentProfiles.getAgentProfile(c.req.param("projectId"), c.req.param("pid"));
            if (!row) return problemJson(c, {status: 404, detail: "Profile not found"});
            return c.json(row, 200);
        } catch (error) {
            log.error({err: error, projectId: c.req.param("projectId"), profileId: c.req.param("pid")}, "[agents:profiles:get] failed");
            return problemJson(c, {status: 502, detail: "Failed to fetch profile"});
        }
    });

    router.patch(
        "/:projectId/agents/profiles/:pid",
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
                        c.req.param("projectId"),
                        c.req.param("pid")
                    );
                    if (!existing) return problemJson(c, {status: 404, detail: "Profile not found"});
                    const agentKey = patch.agent ?? existing.agent;
                    const agent = getAgent(agentKey);
                    if (!agent) return problemJson(c, {status: 400, detail: "Unknown agent"});
                    const parsed = agent.profileSchema.safeParse(cfg);
                    if (!parsed.success)
                        return problemJson(
                            c,
                            {status: 400, title: "Invalid profile", detail: parsed.error.message, errors: parsed.error.flatten()},
                        );
                    cfg = parsed.data;
                }
                const row = await agentProfiles.updateAgentProfile(
                    c.req.param("projectId"),
                    c.req.param("pid"),
                    {name: patch.name, config: cfg}
                );
                if (!row) return problemJson(c, {status: 404, detail: "Profile not found"});
                events.publish("agent.profile.changed", {
                    profileId: row.id,
                    agent: row.agent,
                    kind: "updated",
                    label: row.name,
                });
                return c.json(row, 200);
            } catch (error) {
                log.error(
                    {err: error, projectId: c.req.param("projectId"), profileId: c.req.param("pid")},
                    "[agents:profiles:update] failed",
                );
                return problemJson(c, {status: 502, detail: "Failed to update profile"});
            }
        }
    );

    router.delete("/:projectId/agents/profiles/:pid", async (c) => {
        try {
            const events = c.get("events");
            const existing = await agentProfiles.getAgentProfile(c.req.param("projectId"), c.req.param("pid"));
            if (!existing) return problemJson(c, {status: 404, detail: "Profile not found"});
            await agentProfiles.deleteAgentProfile(c.req.param("projectId"), c.req.param("pid"));
            events.publish("agent.profile.changed", {
                profileId: existing.id,
                agent: existing.agent,
                kind: "deleted",
                label: existing.name,
            });
            return c.body(null, 204);
        } catch (error) {
            log.error(
                {err: error, projectId: c.req.param("projectId"), profileId: c.req.param("pid")},
                "[agents:profiles:delete] failed",
            );
            return problemJson(c, {status: 502, detail: "Failed to delete profile"});
        }
    });

    return router;
};

export const createBoardsRouter = () => {
    const router = new Hono<AppEnv>();
    router.route("/:boardId", createBoardRouter(resolveBoardById));
    return router;
};
