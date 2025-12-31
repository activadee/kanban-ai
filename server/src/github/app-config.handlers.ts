import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {githubRepo} from 'core'
import {listUserRepos} from './api'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'

const appConfigSchema = z.object({
    clientId: z.string().trim().min(1, 'Client ID is required'),
    clientSecret: z.string().trim().min(1).optional().nullable(),
})

export const getGithubAppConfigHandlers = createHandlers(async (c) => {
    const config = await githubRepo.getGithubAppConfig()
    const envValues = c.get('config').env
    const envClientId = envValues.GITHUB_CLIENT_ID?.trim()
    const envSecret = envValues.GITHUB_CLIENT_SECRET?.trim()
    const source: 'db' | 'env' | 'unset' = config ? 'db' : envClientId || envSecret ? 'env' : 'unset'
    return c.json(
        {
            clientId: config?.clientId ?? envClientId ?? null,
            hasClientSecret: Boolean(config?.clientSecret ?? envSecret),
            updatedAt: config?.updatedAt ? new Date(config.updatedAt).toISOString() : null,
            source,
        },
        200,
    )
})

export const updateGithubAppConfigHandlers = createHandlers(
    zValidator('json', appConfigSchema.partial({clientSecret: true})),
    async (c) => {
        const body = c.req.valid('json')
        const saved = await githubRepo.upsertGithubAppConfig({
            clientId: body.clientId.trim(),
            clientSecret:
                body.clientSecret === undefined ? undefined : body.clientSecret ? body.clientSecret.trim() : null,
        })
        return c.json(
            {
                clientId: saved.clientId,
                hasClientSecret: Boolean(saved.clientSecret),
                updatedAt: saved.updatedAt ? new Date(saved.updatedAt).toISOString() : null,
                source: 'db',
            },
            200,
        )
    },
)

export const listGithubReposHandlers = createHandlers(async (c) => {
    try {
        const repos = await listUserRepos()
        return c.json({repos}, 200)
    } catch (error) {
        log.error('github:repos', 'failed', {err: error})
        const message = error instanceof Error ? error.message : 'GitHub repo listing failed'
        const isAuth = message.toLowerCase().includes('not connected') || message.toLowerCase().includes('token')
        return problemJson(c, {
            status: isAuth ? 401 : 502,
            title: isAuth ? 'GitHub authentication required' : 'GitHub repo listing failed',
            detail: message,
        })
    }
})

export const githubLogoutHandlers = createHandlers(async (c) => {
    try {
        await githubRepo.deleteGithubConnection()
        const events = c.get('events')
        events.publish('github.disconnected', {
            disconnectedAt: new Date().toISOString(),
        })
        return c.body(null, 204)
    } catch (error) {
        log.error('github:auth', 'logout failed', {err: error})
        return problemJson(c, {
            status: 502,
            title: 'GitHub logout failed',
            detail: error instanceof Error ? error.message : 'GitHub logout failed',
        })
    }
})
