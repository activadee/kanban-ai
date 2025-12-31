import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {attempts, projectDeps, projectsRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'
import {startAttemptSchema} from '../attempts/attempts.schemas'

const {getCardById, getColumnById} = projectsRepo

const cardIdParam = z.object({cardId: z.string()})

export const getCardAttemptForBoardHandlers = createHandlers(
    zValidator('param', cardIdParam),
    async (c) => {
        const {boardId} = c.get('boardContext')!
        const {cardId} = c.req.valid('param')
        try {
            const data = await attempts.getLatestAttemptForCard(boardId, cardId)
            if (!data) {
                return problemJson(c, {status: 404, detail: 'Attempt not found'})
            }
            return c.json(data, 200)
        } catch (error) {
            log.error('attempts', 'attempt failed', {
                err: error,
                boardId,
                cardId,
            })
            return problemJson(c, {
                status: 502,
                detail: error instanceof Error ? error.message : 'Failed to fetch attempt',
            })
        }
    },
)

export const startCardAttemptForBoardHandlers = createHandlers(
    zValidator('param', cardIdParam),
    zValidator('json', startAttemptSchema),
    async (c) => {
        const {boardId, project} = c.get('boardContext')!
        const {cardId} = c.req.valid('param')
        const body = c.req.valid('json')

        try {
            const card = await getCardById(cardId)
            if (!card) return problemJson(c, {status: 404, detail: 'Card not found'})
            const column = await getColumnById(card.columnId)
            const colTitle = (column?.title || '').trim().toLowerCase()
            if (colTitle === 'done') {
                return problemJson(c, {
                    status: 409,
                    detail: 'Task is done and locked',
                })
            }
            try {
                const {blocked} = await projectDeps.isCardBlocked(card.id)
                if (blocked) {
                    return problemJson(c, {
                        status: 409,
                        detail: 'Task is blocked by dependencies',
                    })
                }
            } catch {}

            const events = c.get('events')
            const attempt = await attempts.startAttempt(
                {
                    boardId,
                    cardId,
                    agent: body.agent,
                    profileId: body.profileId,
                    baseBranch: body.baseBranch,
                    branchName: body.branchName,
                },
                {events},
            )

            c.header('Deprecation', 'true')
            c.header('Link', `</api/v1/projects/${project.id}/cards/${cardId}/attempts>; rel="successor-version"`)

            return c.json(attempt, 201)
        } catch (error) {
            log.error('attempts', 'start failed', {
                err: error,
                boardId,
                cardId,
                agent: body.agent,
                profileId: body.profileId,
            })
            return problemJson(c, {
                status: 502,
                detail: error instanceof Error ? error.message : 'Failed to start attempt',
            })
        }
    },
)
