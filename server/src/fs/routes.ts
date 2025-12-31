import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {listGitReposHandlers, browseFilesHandlers} from './handlers'

export const createFilesystemRouter = () =>
    new Hono<AppEnv>()
        .get('/git-repos', ...listGitReposHandlers)
        .get('/browse', ...browseFilesHandlers)

export type FilesystemRoutes = ReturnType<typeof createFilesystemRouter>
