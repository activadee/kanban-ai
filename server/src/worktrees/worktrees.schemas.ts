import {z} from 'zod'

export const projectIdParam = z.object({
    projectId: z.string().min(1),
})

export const worktreeIdParam = z.object({
    projectId: z.string().min(1),
    id: z.string().min(1),
})

export const deleteWorktreeBody = z.object({
    force: z.boolean().optional().default(false),
    diskOnly: z.boolean().optional().default(false),
})

export const deleteOrphanedParams = z.object({
    projectId: z.string().min(1),
    encodedPath: z.string().min(1),
})

export const deleteOrphanedBody = z.object({
    confirm: z.boolean(),
})

export const deleteStaleParams = z.object({
    projectId: z.string().min(1),
    id: z.string().min(1),
})

export const deleteStaleBody = z.object({
    confirm: z.boolean(),
})
