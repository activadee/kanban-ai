import {Hono} from 'hono'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {
    createGlobalAgentProfileHandler,
    deleteGlobalAgentProfileHandler,
    getAgentProfileSchemaHandler,
    listAgentsHandler,
    listGlobalAgentProfilesHandler,
    updateGlobalAgentProfileHandler,
} from './agents.handlers'
import {createGlobalAgentProfileSchema, updateGlobalAgentProfileSchema} from './agents.schemas'
import {problemJson} from '../http/problem'

export function createAgentsRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', (c) => listAgentsHandler(c))

    router.get('/:agentKey/schema', (c) => getAgentProfileSchemaHandler(c))

    // Global profiles CRUD
    router.get('/profiles', (c) => listGlobalAgentProfilesHandler(c))

    router.post(
        '/profiles',
        zValidator('json', createGlobalAgentProfileSchema),
        (c) => createGlobalAgentProfileHandler(c),
    )

    router.patch(
        '/profiles/:id',
        zValidator('json', updateGlobalAgentProfileSchema),
        (c) => updateGlobalAgentProfileHandler(c),
    )

    router.delete('/profiles/:id', (c) => deleteGlobalAgentProfileHandler(c))

    return router
}
