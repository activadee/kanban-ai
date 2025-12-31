import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getDashboardHandlers} from './handlers'

export const createDashboardRouter = () =>
    new Hono<AppEnv>().get('/', ...getDashboardHandlers)

export type DashboardRoutes = ReturnType<typeof createDashboardRouter>
