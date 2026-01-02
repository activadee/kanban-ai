import {existsSync} from 'node:fs'
import {zValidator} from '@hono/zod-validator'
import {createHandlers} from '../lib/factory'
import {problemJson} from '../http/problem'
import {terminalService} from './terminal.service'
import {terminalResizeSchema, cardIdParamSchema, projectIdParamSchema} from './terminal.schemas'
import {attemptsRepo, projectsRepo} from 'core'

function isDoneColumn(title: string | null | undefined): boolean {
    const value = title?.trim().toLowerCase()
    if (!value) return false
    return value === 'done' || value === 'closed'
}

export const listTerminalsHandlers = createHandlers(
    zValidator('param', projectIdParamSchema),
    async (c) => {
        const {projectId} = c.req.valid('param')
        const terminals = terminalService.listSessionsForProject(projectId)
        return c.json({terminals})
    },
)

export const getTerminalHandlers = createHandlers(
    zValidator('param', cardIdParamSchema),
    async (c) => {
        const {cardId} = c.req.valid('param')
        const session = terminalService.getSession(cardId)

        if (!session) {
            return problemJson(c, {status: 404, detail: 'Terminal session not found'})
        }

        return c.json({
            id: session.cardId,
            cardId: session.cardId,
            projectId: session.projectId,
            attemptId: session.attemptId,
            worktreePath: session.worktreePath,
            cols: session.cols,
            rows: session.rows,
            shell: session.shell,
            createdAt: session.createdAt.toISOString(),
            clientCount: session.clients.size,
        })
    },
)

export const resizeTerminalHandlers = createHandlers(
    zValidator('param', cardIdParamSchema),
    zValidator('json', terminalResizeSchema),
    async (c) => {
        const {cardId} = c.req.valid('param')
        const {cols, rows} = c.req.valid('json')

        if (!terminalService.hasSession(cardId)) {
            return problemJson(c, {status: 404, detail: 'Terminal session not found'})
        }

        terminalService.resize(cardId, cols, rows)
        return c.json({ok: true})
    },
)

export const closeTerminalHandlers = createHandlers(
    zValidator('param', cardIdParamSchema),
    async (c) => {
        const {cardId} = c.req.valid('param')

        if (!terminalService.hasSession(cardId)) {
            return problemJson(c, {status: 404, detail: 'Terminal session not found'})
        }

        terminalService.destroySession(cardId, 'manual')
        return c.json({ok: true})
    },
)

export const listEligibleCardsHandlers = createHandlers(
    zValidator('param', projectIdParamSchema),
    async (c) => {
        const {projectId} = c.req.valid('param')

        const [attempts, columns, cards] = await Promise.all([
            attemptsRepo.listAttemptsForBoard(projectId),
            projectsRepo.listColumnsForBoard(projectId),
            projectsRepo.listCardsForBoard(projectId),
        ])

        const columnTitleById = new Map(columns.map((col) => [col.id, col.title]))
        const cardColumnById = new Map(cards.map((card) => [card.id, card.columnId]))

        const eligible = attempts
            .filter((a) => {
                if (!a.worktreePath || !existsSync(a.worktreePath)) return false
                if (!['running', 'idle', 'succeeded'].includes(a.status)) return false

                const columnId = cardColumnById.get(a.cardId)
                const columnTitle = columnId ? columnTitleById.get(columnId) : null
                if (isDoneColumn(columnTitle)) return false

                return true
            })
            .map((a) => ({
                cardId: a.cardId,
                attemptId: a.id,
                worktreePath: a.worktreePath,
                hasActiveTerminal: terminalService.hasSession(a.cardId),
            }))

        return c.json({eligible})
    },
)
