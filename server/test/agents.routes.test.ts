import {describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import {z} from 'zod'

import {createAgentsRouter} from '../src/agents/routes'

vi.mock('core', () => {
    const profileSchema = z.object({appendPrompt: z.string().optional()})
    const listAgents = vi.fn(() => [
        {key: 'CODEX', label: 'Codex Agent', defaultProfile: {}, profileSchema},
        {key: 'OPENCODE', label: 'OpenCode Agent', defaultProfile: {}, profileSchema},
    ])
    const getAgent = vi.fn((key: string) => {
        const agents = listAgents()
        return agents.find((a) => a.key === key) ?? null
    })
    return {
        bindAgentEventBus: vi.fn(),
        registerAgent: vi.fn(),
        getAgent,
        listAgents,
        CodexAgent: {},
        OpencodeAgent: {},
        agentProfilesGlobal: {
            listGlobalAgentProfiles: vi.fn(),
            getGlobalAgentProfile: vi.fn(),
            createGlobalAgentProfile: vi.fn(),
            updateGlobalAgentProfile: vi.fn(),
            deleteGlobalAgentProfile: vi.fn(),
        },
    }
})

const createApp = () => {
    const app = new Hono()
    app.route('/agents', createAgentsRouter())
    return app
}

describe('Agents routes', () => {
    it('GET /agents returns registered agents including CODEX and OPENCODE', async () => {
        const app = createApp()
        const res = await app.request('/agents')
        expect(res.status).toBe(200)
        const data = (await res.json()) as {agents: Array<{key: string}>}
        const keys = data.agents.map((a) => a.key).sort()
        expect(keys).toContain('CODEX')
        expect(keys).toContain('OPENCODE')
    })

    it('GET /agents/OPENCODE/schema returns a profile schema', async () => {
        const app = createApp()
        const res = await app.request('/agents/OPENCODE/schema')
        expect(res.status).toBe(200)
        const schema = (await res.json()) as {agent: string; fields: unknown[]}
        expect(schema.agent).toBe('OPENCODE')
        expect(Array.isArray(schema.fields)).toBe(true)
    })
})
