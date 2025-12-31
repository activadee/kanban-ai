import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {getEditorSuggestionsHandlers, validateEditorHandlers, openEditorAtPathHandlers} from './handlers'

export const createEditorsRouter = () =>
    new Hono<AppEnv>()
        .get('/suggestions', ...getEditorSuggestionsHandlers)
        .post('/validate', ...validateEditorHandlers)
        .post('/open', ...openEditorAtPathHandlers)

export type EditorsRoutes = ReturnType<typeof createEditorsRouter>
