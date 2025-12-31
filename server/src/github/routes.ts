import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {createGithubAuthRouter} from './auth.routes'
import {createGithubAppConfigRouter} from './app-config.routes'

export const createGithubRouter = () =>
    new Hono<AppEnv>()
        .route('/', createGithubAuthRouter())
        .route('/', createGithubAppConfigRouter())

export type GithubRoutes = ReturnType<typeof createGithubRouter>
