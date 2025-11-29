import {z} from 'zod'
import {defaultDroidProfile, type DroidProfile as Shared} from 'shared'

export const DroidProfileSchema = z.object({
    appendPrompt: z.string().nullable().optional(),
    inlineProfile: z.string().nullable().optional(),
    autonomy: z.enum(['read-only', 'low', 'medium', 'high']).optional(),
    model: z.string().optional(),
    reasoningEffort: z.enum(['off', 'low', 'medium', 'high']).optional(),
    baseCommandOverride: z.string().nullable().optional(),
    additionalParams: z.array(z.string()).optional(),
    debug: z.boolean().optional(),
})

export type DroidProfile = z.infer<typeof DroidProfileSchema>

export const defaultProfile: Shared = defaultDroidProfile
