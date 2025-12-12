import {z} from 'zod'
import {
    MAX_IMAGE_BYTES,
    MAX_IMAGE_DATA_URL_LENGTH,
    MAX_IMAGES_PER_MESSAGE,
    MAX_TOTAL_IMAGE_BYTES,
    estimateDecodedBytesFromDataUrl,
    imageDataUrlPrefix,
} from 'shared'

export const stopAttemptSchema = z.object({
    status: z.enum(['stopped']),
})

const imageAttachmentSchema = z.object({
    id: z.string().optional(),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    dataUrl: z.string().trim().min(1).max(MAX_IMAGE_DATA_URL_LENGTH),
    sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    name: z.string().optional(),
}).superRefine((att, ctx) => {
    const prefix = imageDataUrlPrefix(att.mimeType)
    if (!att.dataUrl.startsWith(prefix)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataUrl'],
            message: `Image dataUrl must start with "${prefix}"`,
        })
        return
    }
    const estimatedBytes = estimateDecodedBytesFromDataUrl(att.dataUrl, prefix.length)
    if (estimatedBytes > MAX_IMAGE_BYTES) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataUrl'],
            message: `Image exceeds ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit`,
        })
    }
})

export const attemptMessageSchema = z
    .object({
        prompt: z.string().optional().default(''),
        profileId: z.string().optional(),
        images: z.array(imageAttachmentSchema).max(MAX_IMAGES_PER_MESSAGE).optional(),
    })
    .superRefine((data, ctx) => {
        const total = (data.images ?? []).reduce((sum, img) => sum + (img.sizeBytes ?? 0), 0)
        if (total > MAX_TOTAL_IMAGE_BYTES) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['images'],
                message: `Total image payload exceeds ${Math.round(MAX_TOTAL_IMAGE_BYTES / (1024 * 1024))}MB limit`,
            })
        }
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
