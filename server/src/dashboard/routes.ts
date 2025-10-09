import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getDashboardOverview} from 'core'

export function createDashboardRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', async (c) => {
        const overview = await getDashboardOverview()
        return c.json(overview)
    })

    return router
}
