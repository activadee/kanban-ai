import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {onboardingService} from 'core'
import {createHandlers} from '../lib/factory'

const stepSchema = z.object({
    step: z.string().trim().max(64).optional(),
})

export const getOnboardingStatusHandlers = createHandlers(async (c) => {
    const status = await onboardingService.getStatus()
    return c.json({status}, 200)
})

export const updateOnboardingProgressHandlers = createHandlers(
    zValidator('json', stepSchema),
    async (c) => {
        const body = c.req.valid('json')
        const status = await onboardingService.record(body.step)
        return c.json({status}, 200)
    },
)

export const completeOnboardingHandlers = createHandlers(
    zValidator('json', stepSchema.optional()),
    async (c) => {
        const body = c.req.valid('json') ?? {}
        const status = await onboardingService.complete(body.step)
        return c.json({status}, 200)
    },
)
