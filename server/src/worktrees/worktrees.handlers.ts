import {zValidator} from '@hono/zod-validator'
import {attemptsRepo, projectsRepo, git} from 'core'
import {problemJson} from '../http/problem'
import {createHandlers} from '../lib/factory'
import {log} from '../log'
import {
    projectIdParam,
    worktreeIdParam,
    deleteWorktreeBody,
    deleteOrphanedParams,
    deleteOrphanedBody,
    deleteStaleParams,
    deleteStaleBody,
} from './worktrees.schemas'
import {
    listWorktreesForProject,
    syncWorktrees,
    checkDeleteConstraints,
    deleteTrackedWorktree,
    deleteOrphanedWorktree,
    type WorktreeServiceDeps,
} from './worktrees.service'

async function createServiceDeps(projectId: string): Promise<WorktreeServiceDeps> {
    return {
        async getProject(id: string) {
            const board = await projectsRepo.getBoardById(id)
            if (!board) return null
            return {
                id: board.id,
                name: board.name,
                repositoryPath: board.repositoryPath,
            }
        },
        async listAttemptsWithCards(boardId: string) {
            const attempts = await attemptsRepo.listAttemptsForBoard(boardId)
            const results = []

            for (const attempt of attempts) {
                const card = await projectsRepo.getCardById(attempt.cardId)
                results.push({
                    id: attempt.id,
                    boardId: attempt.boardId,
                    cardId: attempt.cardId,
                    cardTitle: card?.title ?? null,
                    ticketKey: card?.ticketKey ?? null,
                    worktreePath: attempt.worktreePath ?? null,
                    branchName: attempt.branchName,
                    baseBranch: attempt.baseBranch,
                    status: attempt.status,
                    agent: attempt.agent,
                    createdAt: attempt.createdAt,
                    updatedAt: attempt.updatedAt,
                })
            }

            return results
        },
        async getColumnTitle(cardId: string) {
            const card = await projectsRepo.getCardById(cardId)
            if (!card) return null
            const column = await projectsRepo.getColumnById(card.columnId)
            return column?.title ?? null
        },
        async removeWorktreeFromRepo(repoPath: string, worktreePath: string) {
            await git.removeWorktreeAtPath(repoPath, worktreePath)
        },
    }
}

export const listWorktreesHandlers = createHandlers(
    zValidator('param', projectIdParam),
    async (c) => {
        const {projectId} = c.req.valid('param')

        try {
            const deps = await createServiceDeps(projectId)
            const result = await listWorktreesForProject(projectId, deps)
            return c.json(result, 200)
        } catch (err) {
            if (err instanceof Error && err.message === 'Project not found') {
                return problemJson(c, {status: 404, detail: 'Project not found'})
            }
            throw err
        }
    },
)

export const syncWorktreesHandlers = createHandlers(
    zValidator('param', projectIdParam),
    async (c) => {
        const {projectId} = c.req.valid('param')

        try {
            const deps = await createServiceDeps(projectId)
            const result = await syncWorktrees(projectId, deps)
            return c.json(result, 200)
        } catch (err) {
            if (err instanceof Error && err.message === 'Project not found') {
                return problemJson(c, {status: 404, detail: 'Project not found'})
            }
            throw err
        }
    },
)

export const deleteWorktreeHandlers = createHandlers(
    zValidator('param', worktreeIdParam),
    zValidator('json', deleteWorktreeBody),
    async (c) => {
        const {projectId, id} = c.req.valid('param')
        const {force, diskOnly, deleteBranch, deleteRemoteBranch} = c.req.valid('json')

        const attempt = await attemptsRepo.getAttemptById(id)
        if (!attempt) {
            return problemJson(c, {status: 404, detail: 'Worktree not found'})
        }

        if (attempt.boardId !== projectId) {
            return problemJson(c, {status: 404, detail: 'Worktree not found in this project'})
        }

        if (!attempt.worktreePath) {
            return problemJson(c, {status: 400, detail: 'Attempt has no worktree path'})
        }

        const deps = await createServiceDeps(projectId)

        if (!force) {
            const constraint = await checkDeleteConstraints(id, attempt.status, attempt.cardId, deps)
            if (constraint) {
                return problemJson(c, {
                    status: 409,
                    detail: constraint.reason,
                    activeAttempts: constraint.activeAttempts,
                    cardActive: constraint.cardActive,
                })
            }
        }

        const result = await deleteTrackedWorktree(
            projectId,
            attempt.worktreePath,
            attempt.branchName,
            deps,
            {
                deleteBranch,
                deleteRemoteBranch,
            },
        )

        if (!result.success) {
            return problemJson(c, {status: 500, detail: result.message})
        }

        if (!diskOnly) {
            try {
                await attemptsRepo.updateAttempt(id, {worktreePath: null})
            } catch (err) {
                log.error('worktrees:delete', 'Database update failed after disk deletion', {
                    attemptId: id,
                    err,
                })
                return c.json({
                    success: true,
                    message: 'Worktree deleted from disk, but database update failed. Run sync to fix.',
                    deletedPath: attempt.worktreePath,
                    warning: 'Database may still reference this worktree',
                }, 200)
            }
        }

        return c.json({
            success: true,
            message: result.message,
            deletedPath: attempt.worktreePath,
        }, 200)
    },
)

export const deleteOrphanedWorktreeHandlers = createHandlers(
    zValidator('param', deleteOrphanedParams),
    zValidator('json', deleteOrphanedBody),
    async (c) => {
        const {projectId, encodedPath} = c.req.valid('param')
        const {confirm} = c.req.valid('json')

        if (!confirm) {
            return problemJson(c, {status: 400, detail: 'Confirmation required'})
        }

        const worktreePath = decodeURIComponent(encodedPath)

        const deps = await createServiceDeps(projectId)
        const project = await deps.getProject(projectId)
        if (!project) {
            return problemJson(c, {status: 404, detail: 'Project not found'})
        }

        const result = await deleteOrphanedWorktree(worktreePath, project.repositoryPath)

        if (!result.success) {
            return problemJson(c, {status: 500, detail: result.message})
        }

        return c.json({
            success: true,
            message: result.message,
            deletedPath: worktreePath,
        }, 200)
    },
)

export const deleteStaleWorktreeHandlers = createHandlers(
    zValidator('param', deleteStaleParams),
    zValidator('json', deleteStaleBody),
    async (c) => {
        const {projectId, id} = c.req.valid('param')
        const {confirm} = c.req.valid('json')

        if (!confirm) {
            return problemJson(c, {status: 400, detail: 'Confirmation required'})
        }

        const attempt = await attemptsRepo.getAttemptById(id)
        if (!attempt) {
            return problemJson(c, {status: 404, detail: 'Stale entry not found'})
        }

        if (attempt.boardId !== projectId) {
            return problemJson(c, {status: 404, detail: 'Entry not found in this project'})
        }

        await attemptsRepo.updateAttempt(id, {worktreePath: null})

        return c.json({
            success: true,
            message: 'Stale database entry cleaned up',
        }, 200)
    },
)
