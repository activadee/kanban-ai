import {agentProfilesGlobal} from 'core'
import {getAgent, listAgents} from './registry'
import {buildAgentProfileSchema} from './schema'
import {problemJson} from '../http/problem'
import {log} from '../log'

export async function listAgentsHandler(c: any) {
    const agents = listAgents().map((a) => ({
        key: a.key,
        label: a.label,
        capabilities: a.capabilities ?? {},
    }))
    return c.json({agents})
}

export async function getAgentProfileSchemaHandler(c: any) {
    const key = c.req.param('agentKey')
    const agent = getAgent(key)
    if (!agent) return problemJson(c, {status: 404, detail: 'Unknown agent'})
    try {
        const schema = buildAgentProfileSchema(agent)
        return c.json(schema)
    } catch (err) {
        log.error({err}, '[agents:schema] failed')
        return problemJson(c, {status: 500, detail: 'Failed to build profile schema'})
    }
}

export async function listGlobalAgentProfilesHandler(c: any) {
    const profiles = await agentProfilesGlobal.listGlobalAgentProfiles()
    return c.json({profiles})
}

export async function createGlobalAgentProfileHandler(c: any) {
    try {
        const {agent, name, config} = c.req.valid('json') as {
            agent: string
            name: string
            config: unknown
        }
        const row = await agentProfilesGlobal.createGlobalAgentProfile(agent, name, config)
        if (!row) return problemJson(c, {status: 500, detail: 'Failed to create profile'})
        return c.json(row, 201)
    } catch (err) {
        log.error({err}, '[agents:profiles:create] failed')
        return problemJson(c, {status: 500, detail: 'Failed to create profile'})
    }
}

export async function updateGlobalAgentProfileHandler(c: any) {
    try {
        const id = c.req.param('id')
        const {name, config} = c.req.valid('json') as {
            name?: string
            config?: unknown
        }
        const row = await agentProfilesGlobal.updateGlobalAgentProfile(id, {name, config})
        if (!row) return problemJson(c, {status: 404, detail: 'Profile not found'})
        return c.json(row)
    } catch (err) {
        log.error({err}, '[agents:profiles:update] failed')
        return problemJson(c, {status: 500, detail: 'Failed to update profile'})
    }
}

export async function deleteGlobalAgentProfileHandler(c: any) {
    try {
        const id = c.req.param('id')
        const row = await agentProfilesGlobal.getGlobalAgentProfile(id)
        if (!row) return problemJson(c, {status: 404, detail: 'Profile not found'})
        await agentProfilesGlobal.deleteGlobalAgentProfile(id)
        return c.body(null, 204)
    } catch (err) {
        log.error({err}, '[agents:profiles:delete] failed')
        return problemJson(c, {status: 500, detail: 'Failed to delete profile'})
    }
}

