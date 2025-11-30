import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {startGithubDeviceFlow, pollGithubDeviceFlow, checkGithubConnection} from './auth.service'
import {problemJson} from '../http/problem'
import {log} from '../log'

export const createGithubAuthRouter = () => {
    const router = new Hono<AppEnv>()

    router.post('/device/start', async (c) => {
        try {
            const payload = await startGithubDeviceFlow(c.get('config').env)
            return c.json(payload, 200)
        } catch (error) {
            log.error('github:auth', 'device start failed', {err: error})
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
            log.error('github:auth', 'device poll failed', {err: error})
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
            log.error('github:auth', 'check failed', {err: error})
            return problemJson(c, {
                status: 502,
                title: 'GitHub check failed',
                detail: error instanceof Error ? error.message : 'GitHub check failed',
            })
        }
    })

    return router
}
