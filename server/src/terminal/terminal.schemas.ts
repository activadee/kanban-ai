import {z} from 'zod'

export const terminalResizeSchema = z.object({
    cols: z.number().int().min(1).max(500),
    rows: z.number().int().min(1).max(200),
})

export const cardIdParamSchema = z.object({
    cardId: z.string().min(1),
})

export const projectIdParamSchema = z.object({
    projectId: z.string().min(1),
})
