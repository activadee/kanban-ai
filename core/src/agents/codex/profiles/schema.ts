import {z} from 'zod'
import type {CodexProfile as SharedCodexProfile} from 'shared'

export const CodexProfileSchema = z.object({
    appendPrompt: z.string().nullable().optional(),
    sandbox: z
        .enum(['auto', 'read-only', 'workspace-write', 'danger-full-access'])
        .optional(),
    oss: z.boolean().optional(),
    model: z.string().optional(),
    modelReasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    modelReasoningSummary: z.enum(['auto', 'concise', 'detailed', 'none']).optional(),
    baseCommandOverride: z.string().nullable().optional(),
    additionalParams: z.array(z.string()).optional(),
    debug: z.boolean().optional(),
})

export type CodexProfile = z.infer<typeof CodexProfileSchema>

export const defaultProfile: SharedCodexProfile = {sandbox: 'auto', oss: false, debug: false}
