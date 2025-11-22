import {Hono} from 'hono'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {startGithubDeviceFlow, pollGithubDeviceFlow, checkGithubConnection} from './auth'
import {githubRepo} from 'core'
import {listUserRepos} from './api'

export const createGithubRouter = () => {
    const router = new Hono<AppEnv>()
    const appConfigSchema = z.object({
        clientId: z.string().trim().min(1, 'Client ID is required'),
        clientSecret: z.string().trim().min(1).optional().nullable(),
    })

    router.post('/device/start', async (c) => {
        try {
            const payload = await startGithubDeviceFlow()
            return c.json(payload, 200)
        } catch (error) {
            console.error('[github:device-start] failed', error)
            return c.json({error: error instanceof Error ? error.message : 'GitHub device start failed'}, 500)
        }
    })

    router.post('/device/poll', async (c) => {
        try {
            const result = await pollGithubDeviceFlow()
            if (result.status === 'success') {
                const events = c.get('events')
                events.publish('github.connected', {
                    provider: 'device_flow',
                    connectedAt: new Date().toISOString(),
                })
            }
            return c.json(result, 200)
        } catch (error) {
            console.error('[github:device-poll] failed', error)
            return c.json({
                status: 'error',
                message: error instanceof Error ? error.message : 'GitHub device poll failed'
            }, 500)
        }
    })

    router.get('/check', async (c) => {
        try {
            const result = await checkGithubConnection()
            return c.json(result, 200)
        } catch (error) {
            console.error('[github:check] failed', error)
            return c.json({
                status: 'error',
                message: error instanceof Error ? error.message : 'GitHub check failed'
            }, 500)
        }
    })

    router.get('/app', async (c) => {
        const config = await githubRepo.getGithubAppConfig()
        const envClientId = Bun.env.GITHUB_CLIENT_ID?.trim()
        const envSecret = Bun.env.GITHUB_CLIENT_SECRET?.trim()
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

    router.put('/app', zValidator('json', appConfigSchema.partial({clientSecret: true})), async (c) => {
        const body = c.req.valid('json')
        const saved = await githubRepo.upsertGithubAppConfig({
            clientId: body.clientId.trim(),
            clientSecret: body.clientSecret === undefined ? undefined : (body.clientSecret ? body.clientSecret.trim() : null),
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
    })

    router.get('/repos', async (c) => {
        try {
            const repos = await listUserRepos()
            return c.json({repos}, 200)
        } catch (error) {
            console.error('[github:repos] failed', error)
            return c.json({error: error instanceof Error ? error.message : 'GitHub repo listing failed'}, 500)
        }
    })

    router.post('/logout', async (c) => {
        try {
            await githubRepo.deleteGithubConnection()
            const events = c.get('events')
            events.publish('github.disconnected', {
                disconnectedAt: new Date().toISOString(),
            })
            return c.json({ok: true}, 200)
        } catch (error) {
            console.error('[github:logout] failed', error)
            return c.json({error: error instanceof Error ? error.message : 'GitHub logout failed'}, 500)
        }
    })

    return router
}
