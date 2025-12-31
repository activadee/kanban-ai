import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {agentProfilesGlobal} from 'core'
import {getAgent, listAgents} from './registry'
import {buildAgentProfileSchema} from './schema'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'
import {createGlobalAgentProfileSchema, updateGlobalAgentProfileSchema} from './agents.schemas'

const MAX_PROMPT_CHARS = 4000

function validateProfilePromptLengths(config: unknown) {
    const cfg = config as Record<string, unknown> | null | undefined
    if (!cfg || typeof cfg !== 'object') return null

    const errors: Record<string, string[]> = {}

    const append = cfg.appendPrompt
    if (typeof append === 'string' && append.length > MAX_PROMPT_CHARS) {
        errors.appendPrompt = [`appendPrompt must be at most ${MAX_PROMPT_CHARS} characters`]
    }

    const inline = cfg.inlineProfile
    if (typeof inline === 'string' && inline.length > MAX_PROMPT_CHARS) {
        errors.inlineProfile = [`inlineProfile must be at most ${MAX_PROMPT_CHARS} characters`]
    }

    return Object.keys(errors).length ? errors : null
}

export const listAgentsHandlers = createHandlers((c) => {
    const agents = listAgents().map((a) => ({
        key: a.key,
        label: a.label,
        capabilities: a.capabilities ?? {},
    }))
    return c.json({agents})
})

export const getAgentProfileSchemaHandlers = createHandlers(
    zValidator('param', z.object({agentKey: z.string()})),
    async (c) => {
        const {agentKey} = c.req.valid('param')
        const agent = getAgent(agentKey)
        if (!agent) return problemJson(c, {status: 404, detail: 'Unknown agent'})
        try {
            const schema = buildAgentProfileSchema(agent)
            return c.json(schema)
        } catch (err) {
            log.error('agents:schema', 'failed', {err})
            return problemJson(c, {status: 500, detail: 'Failed to build profile schema'})
        }
    },
)

export const listGlobalAgentProfilesHandlers = createHandlers(async (c) => {
    const profiles = await agentProfilesGlobal.listGlobalAgentProfiles()
    return c.json({profiles})
})

export const createGlobalAgentProfileHandlers = createHandlers(
    zValidator('json', createGlobalAgentProfileSchema),
    async (c) => {
        try {
            const {agent, name, config} = c.req.valid('json')
            const agentDef = getAgent(agent)
            if (!agentDef) {
                return problemJson(c, {status: 400, detail: 'Unknown agent'})
            }

            const parsed = agentDef.profileSchema.safeParse(config)
            if (!parsed.success) {
                return problemJson(c, {
                    status: 400,
                    title: 'Invalid profile',
                    detail: parsed.error.message,
                    errors: parsed.error.flatten(),
                })
            }

            const lengthErrors = validateProfilePromptLengths(parsed.data)
            if (lengthErrors) {
                return problemJson(c, {
                    status: 400,
                    title: 'Invalid profile',
                    detail: 'Profile prompts are too long',
                    errors: {fieldErrors: lengthErrors, formErrors: []},
                })
            }

            const row = await agentProfilesGlobal.createGlobalAgentProfile(agent, name, parsed.data)
            if (!row) return problemJson(c, {status: 500, detail: 'Failed to create profile'})
            return c.json(row, 201)
        } catch (err) {
            log.error('agents:profiles', 'create failed', {err})
            return problemJson(c, {status: 500, detail: 'Failed to create profile'})
        }
    },
)

export const updateGlobalAgentProfileHandlers = createHandlers(
    zValidator('param', z.object({id: z.string()})),
    zValidator('json', updateGlobalAgentProfileSchema),
    async (c) => {
        try {
            const {id} = c.req.valid('param')
            const {name, config} = c.req.valid('json')
            const existing = await agentProfilesGlobal.getGlobalAgentProfile(id)
            if (!existing) return problemJson(c, {status: 404, detail: 'Profile not found'})

            let cfg = config
            if (cfg !== undefined) {
                const agentDef = getAgent(existing.agent)
                if (!agentDef) {
                    return problemJson(c, {status: 400, detail: 'Unknown agent'})
                }
                const parsed = agentDef.profileSchema.safeParse(cfg)
                if (!parsed.success) {
                    return problemJson(c, {
                        status: 400,
                        title: 'Invalid profile',
                        detail: parsed.error.message,
                        errors: parsed.error.flatten(),
                    })
                }
                const lengthErrors = validateProfilePromptLengths(parsed.data)
                if (lengthErrors) {
                    return problemJson(c, {
                        status: 400,
                        title: 'Invalid profile',
                        detail: 'Profile prompts are too long',
                        errors: {fieldErrors: lengthErrors, formErrors: []},
                    })
                }
                cfg = parsed.data
            }

            const row = await agentProfilesGlobal.updateGlobalAgentProfile(id, {name, config: cfg})
            if (!row) return problemJson(c, {status: 404, detail: 'Profile not found'})
            return c.json(row)
        } catch (err) {
            log.error('agents:profiles', 'update failed', {err})
            return problemJson(c, {status: 500, detail: 'Failed to update profile'})
        }
    },
)

export const deleteGlobalAgentProfileHandlers = createHandlers(
    zValidator('param', z.object({id: z.string()})),
    async (c) => {
        try {
            const {id} = c.req.valid('param')
            const row = await agentProfilesGlobal.getGlobalAgentProfile(id)
            if (!row) return problemJson(c, {status: 404, detail: 'Profile not found'})
            await agentProfilesGlobal.deleteGlobalAgentProfile(id)
            return c.body(null, 204)
        } catch (err) {
            log.error('agents:profiles', 'delete failed', {err})
            return problemJson(c, {status: 500, detail: 'Failed to delete profile'})
        }
    },
)
