import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    listAgentsHandlers,
    getAgentProfileSchemaHandlers,
    listGlobalAgentProfilesHandlers,
    createGlobalAgentProfileHandlers,
    updateGlobalAgentProfileHandlers,
    deleteGlobalAgentProfileHandlers,
} from './agents.handlers'

export const createAgentsRouter = () =>
    new Hono<AppEnv>()
        .get('/', ...listAgentsHandlers)
        .get('/:agentKey/schema', ...getAgentProfileSchemaHandlers)
        .get('/profiles', ...listGlobalAgentProfilesHandlers)
        .post('/profiles', ...createGlobalAgentProfileHandlers)
        .patch('/profiles/:id', ...updateGlobalAgentProfileHandlers)
        .delete('/profiles/:id', ...deleteGlobalAgentProfileHandlers)

export type AgentsRoutes = ReturnType<typeof createAgentsRouter>
