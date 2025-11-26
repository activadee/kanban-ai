import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {createGithubAuthRouter} from './auth.routes'
import {createGithubAppConfigRouter} from './app-config.routes'

export const createGithubRouter = () => {
    const router = new Hono<AppEnv>()
    router.route('/', createGithubAuthRouter())
    router.route('/', createGithubAppConfigRouter())

    return router
}
