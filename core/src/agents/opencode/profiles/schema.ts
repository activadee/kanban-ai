import {z} from 'zod'
import {
    defaultOpencodeProfile,
    type OpencodeProfile as SharedOpencodeProfile,
} from 'shared'
import {BaseProfileSchema} from '../../profiles/base'

export const OpencodeProfileSchema = BaseProfileSchema.extend({
    agent: z.string().optional(),
    model: z.string().optional(),
    baseUrl: z.string().nullable().optional(),
    apiKey: z.string().nullable().optional(),
})

export type OpencodeProfile = z.infer<typeof OpencodeProfileSchema>

export const defaultProfile: SharedOpencodeProfile = defaultOpencodeProfile
