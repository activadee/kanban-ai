import {z} from 'zod'

export const stopAttemptSchema = z.object({
    status: z.enum(['stopped']),
})

const imageAttachmentSchema = z.object({
    id: z.string().optional(),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    dataUrl: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    name: z.string().optional(),
})

export const attemptMessageSchema = z
    .object({
        prompt: z.string().optional().default(''),
        profileId: z.string().optional(),
        images: z.array(imageAttachmentSchema).optional(),
    })
    .refine(
        (data) => (data.prompt?.trim().length ?? 0) > 0 || (data.images?.length ?? 0) > 0,
        {message: 'Provide a prompt or at least one image'},
    )

export const openEditorSchema = z.object({
    subpath: z.string().optional(),
    editorKey: z.string().optional(),
})

export const gitCommitSchema = z.object({
    subject: z.string().min(1),
    body: z.string().optional(),
})

export const gitPushSchema = z.object({
    setUpstream: z.boolean().optional(),
})

export const attemptPrSchema = z.object({
    base: z.string().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    draft: z.boolean().optional(),
})

// Canonical schema for starting an attempt for a board/card.
// Only agents that are actually registered on the server should be listed here.
// Codex and OpenCode are supported; Droid and any legacy
// ECHO/SHELL agents remain WIP/unsupported and are intentionally excluded.
export const startAttemptSchema = z.object({
    agent: z.enum(['CODEX', 'OPENCODE']),
    profileId: z.string().optional(),
    baseBranch: z.string().min(1).optional(),
    branchName: z.string().min(1).optional(),
})
