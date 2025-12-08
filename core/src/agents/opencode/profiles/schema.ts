import {z} from 'zod'
import {
    defaultOpencodeProfile,
    type OpencodeProfile as SharedOpencodeProfile,
} from 'shared'

export const OpencodeProfileSchema = z.object({
    appendPrompt: z.string().nullable().optional(),
    inlineProfile: z.string().nullable().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    baseUrl: z.string().nullable().optional(),
    apiKey: z.string().nullable().optional(),
    debug: z.boolean().optional(),
})

export type OpencodeProfile = z.infer<typeof OpencodeProfileSchema>

export const defaultProfile: SharedOpencodeProfile = defaultOpencodeProfile
