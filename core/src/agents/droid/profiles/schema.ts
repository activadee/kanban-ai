import {z} from 'zod'
import {defaultDroidProfile, type DroidProfile as Shared} from 'shared'

export const DroidProfileSchema = z.object({
    appendPrompt: z.string().nullable().optional(),
    inlineProfile: z.string().nullable().optional(),
    model: z.string().optional(),
    autonomyLevel: z.enum(['default', 'low', 'medium', 'high']).optional(),
    reasoningEffort: z.enum(['off', 'none', 'low', 'medium', 'high']).optional(),
    useSpec: z.boolean().optional(),
    specModel: z.string().optional(),
    specReasoningEffort: z.enum(['off', 'none', 'low', 'medium', 'high']).optional(),
    enabledTools: z.array(z.string()).optional(),
    disabledTools: z.array(z.string()).optional(),
    skipPermissionsUnsafe: z.boolean().optional(),
    baseCommandOverride: z.string().nullable().optional(),
    debug: z.boolean().optional(),
    enableImages: z.boolean().optional(),
})

export type DroidProfile = z.infer<typeof DroidProfileSchema>

export const defaultProfile: Shared = defaultDroidProfile
