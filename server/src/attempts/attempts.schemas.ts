import {z} from 'zod'

const MAX_IMAGES_PER_MESSAGE = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4
// Add slack for the "data:<mime>;base64," prefix and any minor variance.
const MAX_IMAGE_DATA_URL_LENGTH = 64 + MAX_IMAGE_BASE64_LENGTH

function estimateDecodedBytesFromDataUrl(dataUrl: string, base64PrefixLength: number): number {
    const base64Len = Math.max(0, dataUrl.length - base64PrefixLength)
    let padding = 0
    if (dataUrl.endsWith('==')) padding = 2
    else if (dataUrl.endsWith('=')) padding = 1
    const bytes = Math.floor((base64Len * 3) / 4) - padding
    return bytes < 0 ? 0 : bytes
}

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
    const prefix = `data:${att.mimeType};base64,`
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
