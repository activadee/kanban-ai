import {Hono} from 'hono'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {startGithubDeviceFlow, pollGithubDeviceFlow, checkGithubConnection} from './auth'
import {githubRepo} from 'core'
import {listUserRepos} from './api'
import {problemJson} from '../http/problem'
import {log} from '../log'

export const createGithubRouter = () => {
    const router = new Hono<AppEnv>()
    const appConfigSchema = z.object({
        clientId: z.string().trim().min(1, 'Client ID is required'),
        clientSecret: z.string().trim().min(1).optional().nullable(),
    })

    router.post('/device/start', async (c) => {
        try {
            const payload = await startGithubDeviceFlow(c.get('config').env)
            return c.json(payload, 200)
        } catch (error) {
            log.error({err: error}, '[github:device-start] failed')
            return problemJson(c, {
                status: 503,
                title: 'GitHub device flow unavailable',
                detail: error instanceof Error ? error.message : 'GitHub device start failed',
            })
        }
    })

    router.post('/device/poll', async (c) => {
        try {
            const result = await pollGithubDeviceFlow(c.get('config').env)
            if (result.status === 'success') {
                const events = c.get('events')
                events.publish('github.connected', {
                    provider: 'device_flow',
                    connectedAt: new Date().toISOString(),
                })
                return c.json(result, 200)
            }

            if (result.status === 'authorization_pending') {
                return c.json(result, 202)
            }

            if (result.status === 'slow_down') {
                if (result.retryAfterSeconds) {
                    c.header('Retry-After', String(result.retryAfterSeconds))
                }
                return c.json(result, 429)
            }

            if (result.status === 'expired') {
                return problemJson(c, {
                    status: 410,
                    title: 'GitHub device code expired',
                    detail: 'Start a new GitHub device login to continue.',
                })
            }

            if (result.status === 'access_denied') {
                return problemJson(c, {
                    status: 403,
                    title: 'GitHub access denied',
                    detail: 'The GitHub device request was rejected by the user.',
                })
            }

            return problemJson(c, {
                status: 502,
                title: 'GitHub device poll failed',
                detail: result.message ?? 'GitHub device poll failed',
            })
        } catch (error) {
            log.error({err: error}, '[github:device-poll] failed')
            return problemJson(c, {
                status: 502,
                title: 'GitHub device poll failed',
                detail: error instanceof Error ? error.message : 'GitHub device poll failed',
            })
        }
    })

    router.get('/check', async (c) => {
        try {
            const result = await checkGithubConnection()
            return c.json(result, 200)
        } catch (error) {
            log.error({err: error}, '[github:check] failed')
            return problemJson(c, {
                status: 502,
                title: 'GitHub check failed',
                detail: error instanceof Error ? error.message : 'GitHub check failed',
            })
        }
    })

    router.get('/app', async (c) => {
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
            log.error({err: error}, '[github:repos] failed')
            const message = error instanceof Error ? error.message : 'GitHub repo listing failed'
            const isAuth = message.toLowerCase().includes('not connected') || message.toLowerCase().includes('token')
            return problemJson(c, {
                status: isAuth ? 401 : 502,
                title: isAuth ? 'GitHub authentication required' : 'GitHub repo listing failed',
                detail: message,
            })
        }
    })

    router.post('/logout', async (c) => {
        try {
            await githubRepo.deleteGithubConnection()
            const events = c.get('events')
            events.publish('github.disconnected', {
                disconnectedAt: new Date().toISOString(),
            })
            return c.body(null, 204)
        } catch (error) {
            log.error({err: error}, '[github:logout] failed')
            return problemJson(c, {
                status: 502,
                title: 'GitHub logout failed',
                detail: error instanceof Error ? error.message : 'GitHub logout failed',
            })
        }
    })

    return router
}
