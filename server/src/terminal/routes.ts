import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    listTerminalsHandlers,
    getTerminalHandlers,
    resizeTerminalHandlers,
    closeTerminalHandlers,
    listEligibleCardsHandlers,
} from './terminal.handlers'

export const createTerminalRouter = () =>
    new Hono<AppEnv>()
        .get('/:cardId', ...getTerminalHandlers)
        .post('/:cardId/resize', ...resizeTerminalHandlers)
        .delete('/:cardId', ...closeTerminalHandlers)

export const createProjectTerminalRouter = () =>
    new Hono<AppEnv>().get('/', ...listTerminalsHandlers).get('/eligible', ...listEligibleCardsHandlers)

export type TerminalRoutes = ReturnType<typeof createTerminalRouter>
