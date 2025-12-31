import {discoverGitRepositories, browseDirectory} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'

export const listGitReposHandlers = createHandlers(async (c) => {
    try {
        const path = c.req.query('path')
        const entries = await discoverGitRepositories({basePath: path ?? undefined})
        return c.json({entries}, 200)
    } catch (error) {
        log.error('fs:git-repos', 'failed', {err: error})
        return problemJson(c, {status: 502, detail: 'Failed to scan for git repositories'})
    }
})

export const browseFilesHandlers = createHandlers(async (c) => {
    const path = c.req.query('path') || undefined
    const showHidden = c.req.query('showHidden') === 'true'
    const executablesOnly = c.req.query('executablesOnly') === 'true'

    try {
        const result = await browseDirectory({path, showHidden, executablesOnly})
        return c.json(result, 200)
    } catch (error) {
        log.error('fs:browse', 'failed', {err: error})
        return problemJson(c, {status: 400, detail: 'Failed to browse directory'})
    }
})
