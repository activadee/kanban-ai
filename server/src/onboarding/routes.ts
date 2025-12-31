import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    getOnboardingStatusHandlers,
    updateOnboardingProgressHandlers,
    completeOnboardingHandlers,
} from './handlers'

export const createOnboardingRouter = () =>
    new Hono<AppEnv>()
        .get('/status', ...getOnboardingStatusHandlers)
        .patch('/progress', ...updateOnboardingProgressHandlers)
        .post('/complete', ...completeOnboardingHandlers)

export type OnboardingRoutes = ReturnType<typeof createOnboardingRouter>
