import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {importGithubIssues} from '../github/import.service'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'
import {boardGithubImportSchema} from './project.schemas'

export const importGithubIssuesHandlers = createHandlers(
    zValidator('json', boardGithubImportSchema),
    async (c) => {
        const {boardId, project} = c.get('boardContext')!
        const {owner, repo, state} = c.req.valid('json')

        try {
            const events = c.get('events')
            const result = await importGithubIssues(
                {
                    boardId,
                    owner,
                    repo,
                    state,
                },
                {
                    bus: events,
                    logContext: {
                        projectId: project.id,
                        boardId,
                        owner,
                        repo,
                        state: state ?? 'open',
                        trigger: 'manual',
                    },
                },
            )
            return c.json(result, 200)
        } catch (error) {
            log.error('board:import:github', 'failed', {
                err: error,
                boardId,
                owner,
                repo,
                state,
            })
            const detail = error instanceof Error ? error.message : 'GitHub import failed'
            const status = detail.toLowerCase().includes('github') ? 502 : 500
            return problemJson(c, {status, detail})
        }
    },
)
