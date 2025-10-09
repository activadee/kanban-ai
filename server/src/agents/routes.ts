import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getAgent, listAgents} from './registry'
import {buildAgentProfileSchema} from './schema'
import {agentProfilesGlobal} from 'core'
import {z} from 'zod'

export function createAgentsRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', async (c) => {
        // Return a minimal, serializable set of info for the client
        const agents = listAgents().map((a) => ({key: a.key, label: a.label, capabilities: a.capabilities ?? {}}))
        return c.json({agents})
    })

    router.get('/:agentKey/schema', async (c) => {
        const key = c.req.param('agentKey')
        const agent = getAgent(key)
        if (!agent) return c.json({error: 'Unknown agent'}, 404)
        try {
            const schema = buildAgentProfileSchema(agent)
            return c.json(schema)
        } catch (err) {
            console.error('[agents:schema] failed', err)
            return c.json({error: 'Failed to build profile schema'}, 500)
        }
    })

    // Global profiles CRUD
    router.get('/profiles', async (c) => {
        const profiles = await agentProfilesGlobal.listGlobalAgentProfiles()
        return c.json({profiles})
    })
    router.post('/profiles', async (c) => {
        try {
            const body = await c.req.json()
            const parsed = z.object({agent: z.string(), name: z.string().min(1), config: z.any()}).safeParse(body)
            if (!parsed.success) return c.json({error: parsed.error.message}, 400)
            const row = await agentProfilesGlobal.createGlobalAgentProfile(parsed.data.agent, parsed.data.name, parsed.data.config)
            if (!row) return c.json({error: 'Failed to create'}, 500)
            return c.json(row, 201)
        } catch (err) {
            console.error('[agents:profiles:create] failed', err)
            return c.json({error: 'Failed to create profile'}, 500)
        }
    })
    router.patch('/profiles/:id', async (c) => {
        try {
            const id = c.req.param('id')
            const body = await c.req.json()
            const parsed = z.object({name: z.string().min(1).optional(), config: z.any().optional()}).safeParse(body)
            if (!parsed.success) return c.json({error: parsed.error.message}, 400)
            const row = await agentProfilesGlobal.updateGlobalAgentProfile(id, {
                name: parsed.data.name,
                config: parsed.data.config
            })
            if (!row) return c.json({error: 'Not found'}, 404)
            return c.json(row)
        } catch (err) {
            console.error('[agents:profiles:update] failed', err)
            return c.json({error: 'Failed to update profile'}, 500)
        }
    })
    router.delete('/profiles/:id', async (c) => {
        try {
            const id = c.req.param('id')
            const row = await agentProfilesGlobal.getGlobalAgentProfile(id)
            if (!row) return c.json({error: 'Not found'}, 404)
            await agentProfilesGlobal.deleteGlobalAgentProfile(id)
            return c.json({ok: true})
        } catch (err) {
            console.error('[agents:profiles:delete] failed', err)
            return c.json({error: 'Failed to delete profile'}, 500)
        }
    })

    return router
}
