import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    getGithubAppConfigHandlers,
    updateGithubAppConfigHandlers,
    listGithubReposHandlers,
    githubLogoutHandlers,
} from './app-config.handlers'

export const createGithubAppConfigRouter = () =>
    new Hono<AppEnv>()
        .get('/app', ...getGithubAppConfigHandlers)
        .put('/app', ...updateGithubAppConfigHandlers)
        .get('/repos', ...listGithubReposHandlers)
        .post('/logout', ...githubLogoutHandlers)

export type GithubAppConfigRoutes = ReturnType<typeof createGithubAppConfigRouter>
