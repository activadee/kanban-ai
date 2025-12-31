import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getVersionHandlers} from './handlers'

export const createVersionRouter = () =>
    new Hono<AppEnv>().get('/', ...getVersionHandlers)

export type VersionRoutes = ReturnType<typeof createVersionRouter>
