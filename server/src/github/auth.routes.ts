import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {startDeviceFlowHandlers, pollDeviceFlowHandlers, checkGithubAuthHandlers} from './auth.handlers'

export const createGithubAuthRouter = () =>
    new Hono<AppEnv>()
        .post('/device/start', ...startDeviceFlowHandlers)
        .post('/device/poll', ...pollDeviceFlowHandlers)
        .get('/check', ...checkGithubAuthHandlers)

export type GithubAuthRoutes = ReturnType<typeof createGithubAuthRouter>
