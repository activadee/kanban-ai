import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {discoverGitRepositories} from 'core'

export const createFilesystemRouter = () => {
    const router = new Hono<AppEnv>()

    router.get('/git-repos', async (c) => {
        try {
            const path = c.req.query('path')
            const entries = await discoverGitRepositories({basePath: path ?? undefined})
            return c.json({entries}, 200)
        } catch (error) {
            console.error('[fs:git-repos] failed', error)
            return c.json({error: 'Failed to scan for git repositories'}, 500)
        }
    })

    return router
}
