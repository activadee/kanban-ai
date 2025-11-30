import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getAppVersionInfo} from './service'

export function createVersionRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', async (c) => {
        const version = await getAppVersionInfo()
        return c.json(version)
    })

    return router
}
