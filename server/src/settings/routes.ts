import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getAppSettingsHandlers, updateAppSettingsHandlers} from './handlers'

export const createAppSettingsRouter = () =>
    new Hono<AppEnv>()
        .get('/', ...getAppSettingsHandlers)
        .patch('/', ...updateAppSettingsHandlers)

export type AppSettingsRoutes = ReturnType<typeof createAppSettingsRouter>
