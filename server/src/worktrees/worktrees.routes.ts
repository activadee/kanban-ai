import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    listWorktreesHandlers,
    syncWorktreesHandlers,
    deleteWorktreeHandlers,
    deleteOrphanedWorktreeHandlers,
    deleteStaleWorktreeHandlers,
} from './worktrees.handlers'

export const createWorktreesRouter = () =>
    new Hono<AppEnv>()
        .get('/', ...listWorktreesHandlers)
        .post('/sync', ...syncWorktreesHandlers)
        .delete('/:id', ...deleteWorktreeHandlers)
        .delete('/orphaned/:encodedPath', ...deleteOrphanedWorktreeHandlers)
        .delete('/stale/:id', ...deleteStaleWorktreeHandlers)

export type WorktreesRoutes = ReturnType<typeof createWorktreesRouter>
