import {z} from 'zod'
import {defaultDroidProfile, type DroidProfile as Shared} from 'shared'
import {BaseProfileSchema} from '../../profiles/base'

export const DroidProfileSchema = BaseProfileSchema.extend({
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
})

export type DroidProfile = z.infer<typeof DroidProfileSchema>

export const defaultProfile: Shared = defaultDroidProfile
