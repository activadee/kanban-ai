import {z} from 'zod'
import {SUPPORTED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_IMAGES_PER_MESSAGE} from 'shared'

export const stopAttemptSchema = z.object({
    status: z.enum(['stopped']),
})

/**
 * Schema for validating image attachments in messages.
 */
export const messageImageSchema = z.object({
    /** Base64-encoded image data (without data URL prefix) */
    data: z
        .string()
        .min(1)
        .refine(
            (val) => {
                // Estimate decoded size (base64 is ~4/3 of original)
                const estimatedSize = (val.length * 3) / 4
                return estimatedSize <= MAX_IMAGE_SIZE_BYTES
            },
            {message: `Image exceeds maximum size of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`}
        ),
    /** MIME type of the image */
    mime: z.enum(SUPPORTED_IMAGE_MIME_TYPES as unknown as [string, ...string[]]),
    /** Optional filename for the image */
    name: z.string().optional(),
})

export const attemptMessageSchema = z.object({
    prompt: z.string().min(1),
    profileId: z.string().optional(),
    /** Optional array of image attachments */
    images: z
        .array(messageImageSchema)
        .max(MAX_IMAGES_PER_MESSAGE, {
            message: `Maximum ${MAX_IMAGES_PER_MESSAGE} images allowed per message`,
        })
        .optional(),
})

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
// Codex, OpenCode, and Droid are supported; legacy ECHO/SHELL agents
// remain WIP/unsupported and are intentionally excluded.
export const startAttemptSchema = z.object({
    agent: z.enum(['CODEX', 'OPENCODE', 'DROID']),
    profileId: z.string().optional(),
    baseBranch: z.string().min(1).optional(),
    branchName: z.string().min(1).optional(),
})
