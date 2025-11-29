import {z} from "zod";
import type {CreateProjectRequest, UpdateProjectRequest} from "shared";

export const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    repositoryPath: z.string().min(1, "Repository path is required"),
    initialize: z.boolean().optional(),
    repositorySlug: z.string().min(1).optional().nullable(),
    repositoryUrl: z.url().optional().nullable(),
}) satisfies z.ZodType<CreateProjectRequest>;

export const updateProjectSchema = z
    .object({
        name: z.string().min(1, "Project name cannot be empty").optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "No updates provided",
    }) satisfies z.ZodType<UpdateProjectRequest>;

export const updateProjectSettingsSchema = z
    .object({
        baseBranch: z.string().min(1).optional(),
        preferredRemote: z.string().optional().nullable(),
        setupScript: z.string().optional().nullable(),
        devScript: z.string().optional().nullable(),
        cleanupScript: z.string().optional().nullable(),
        copyFiles: z.string().optional().nullable(),
        defaultAgent: z.string().optional().nullable(),
        defaultProfileId: z.string().optional().nullable(),
        inlineAgent: z.string().optional().nullable(),
        inlineProfileId: z.string().optional().nullable(),
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

export const enhanceTicketSchema = z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    agent: z.string().optional(),
    profileId: z.string().optional(),
});

export const createCardSchema = z.object({
    columnId: z.string().min(1, "Column ID is required"),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    dependsOn: z.array(z.string()).optional(),
});

export const updateCardSchema = z
    .object({
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        dependsOn: z.array(z.string()).optional(),
        columnId: z.string().min(1, "Column ID is required").optional(),
        index: z.number().int().min(0).optional(),
    })
    .superRefine((data, ctx) => {
        const hasContent =
            data.title !== undefined ||
            data.description !== undefined ||
            data.dependsOn !== undefined;
        const wantsMove = data.columnId !== undefined || data.index !== undefined;

        if (wantsMove && (data.columnId === undefined || data.index === undefined)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "columnId and index are required to move a card",
            });
        }

        if (!hasContent && !wantsMove) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "No updates provided",
            });
        }
    });

export const agentProfilePatchSchema = z.object({
    name: z.string().min(1).optional(),
    config: z.any().optional(),
    agent: z.string().optional(),
});

export const boardGithubImportSchema = z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    state: z.enum(["open", "closed", "all"]).optional(),
});
