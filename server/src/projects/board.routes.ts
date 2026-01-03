import {Hono} from 'hono'
import type {AppEnv, AppContext, BoardContext} from '../env'
import {problemJson} from '../http/problem'
import {createMiddleware} from '../lib/factory'
import {getBoardStateHandlers} from './board.state.handlers'
import {createCardHandlers, updateCardHandlers, deleteCardHandlers, getCardImagesHandlers, createCardGithubIssueHandlers} from './board.card.handlers'
import {getCardAttemptForBoardHandlers, startCardAttemptForBoardHandlers} from './board.attempt.handlers'
import {importGithubIssuesHandlers} from './board.import.handlers'
import {getGithubIssueStatsHandlers} from './board.github.handlers'

export type {BoardContext}

export const resolveBoardForProject = async (c: AppContext): Promise<BoardContext | null> => {
    const {projects} = c.get('services')
    const projectId = c.req.param('projectId') as string
    const project = await projects.get(projectId)
    if (!project) return null
    return {boardId: project.boardId ?? project.id, project}
}

export const resolveBoardById = async (c: AppContext): Promise<BoardContext | null> => {
    const {projects} = c.get('services')
    const boardId = c.req.param('boardId') as string
    const project = await projects.get(boardId)
    if (!project) return null
    return {boardId: project.boardId ?? project.id, project}
}

export function createBoardRouter(
    resolveBoard: (c: AppContext) => Promise<BoardContext | null>,
) {
    const boardMiddleware = createMiddleware(async (c, next) => {
        const ctx = await resolveBoard(c)
        if (!ctx) {
            return problemJson(c, {status: 404, detail: 'Board not found'})
        }
        c.set('boardContext', ctx)
        await next()
    })

    return new Hono<AppEnv>()
        .use('/*', boardMiddleware)
        .get('/', ...getBoardStateHandlers)
        .post('/cards', ...createCardHandlers)
        .patch('/cards/:cardId', ...updateCardHandlers)
        .delete('/cards/:cardId', ...deleteCardHandlers)
        .get('/cards/:cardId/images', ...getCardImagesHandlers)
        .post('/cards/:cardId/github/issue', ...createCardGithubIssueHandlers)
        .get('/cards/:cardId/attempt', ...getCardAttemptForBoardHandlers)
        .post('/cards/:cardId/attempts', ...startCardAttemptForBoardHandlers)
        .post('/import/github/issues', ...importGithubIssuesHandlers)
        .get('/github/issues/stats', ...getGithubIssueStatsHandlers)
}

export const createBoardsRouter = () => {
    const router = new Hono<AppEnv>()
    router.route('/:boardId', createBoardRouter(resolveBoardById))
    return router
}
