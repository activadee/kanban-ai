import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {startGithubDeviceFlow, pollGithubDeviceFlow, checkGithubConnection} from './auth'
import {githubRepo} from 'core'
import {listUserRepos} from './api'

export const createGithubRouter = () => {
    const router = new Hono<AppEnv>()

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
