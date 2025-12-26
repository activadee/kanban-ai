import {z} from 'zod'

export const savePlanSchema = z.object({
    planMarkdown: z.string().min(1),
    sourceMessageId: z.string().optional(),
    sourceAttemptId: z.string().optional(),
})

