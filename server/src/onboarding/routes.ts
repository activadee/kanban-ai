import {Hono} from 'hono'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {onboardingService} from 'core'

const stepSchema = z.object({
    step: z.string().trim().max(64).optional(),
})

export function createOnboardingRouter() {
    const router = new Hono<AppEnv>()

    router.get('/status', async (c) => {
        const status = await onboardingService.getStatus()
        return c.json({status}, 200)
    })

    router.patch('/progress', zValidator('json', stepSchema), async (c) => {
        const body = c.req.valid('json')
        const status = await onboardingService.record(body.step)
        return c.json({status}, 200)
    })

    router.post('/complete', zValidator('json', stepSchema.optional()), async (c) => {
        const body = c.req.valid('json') ?? {}
        const status = await onboardingService.complete(body.step)
        return c.json({status}, 200)
    })

    return router
}
