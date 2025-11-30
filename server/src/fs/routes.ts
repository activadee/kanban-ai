import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {discoverGitRepositories} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'

export const createFilesystemRouter = () => {
    const router = new Hono<AppEnv>()

    router.get('/git-repos', async (c) => {
        try {
            const path = c.req.query('path')
            const entries = await discoverGitRepositories({basePath: path ?? undefined})
            return c.json({entries}, 200)
        } catch (error) {
            log.error('fs:git-repos', 'failed', {err: error})
            return problemJson(c, {status: 502, detail: 'Failed to scan for git repositories'})
        }
    })

    return router
}
