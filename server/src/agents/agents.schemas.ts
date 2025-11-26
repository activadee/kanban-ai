import {z} from 'zod'

export const createGlobalAgentProfileSchema = z.object({
    agent: z.string(),
    name: z.string().min(1),
    config: z.any(),
})

export const updateGlobalAgentProfileSchema = z.object({
    name: z.string().min(1).optional(),
    config: z.any().optional(),
})

