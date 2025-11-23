import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../src/attempts/repo', () => ({
    getAttemptForCard: vi.fn(),
    updateAttempt: vi.fn(),
}))

vi.mock('../src/projects/repo', () => ({
    getRepositoryPath: vi.fn(),
}))

vi.mock('../src/ports/worktree', () => ({
    removeWorktree: vi.fn(),
}))

const branchLocal = vi.fn()
const deleteLocalBranch = vi.fn()
const checkout = vi.fn()

vi.mock('simple-git', () => ({
    default: (..._args: unknown[]) => ({branchLocal, deleteLocalBranch, checkout}),
}))

import {cleanupCardWorkspace} from '../src/tasks/cleanup'
import {getAttemptForCard, updateAttempt} from '../src/attempts/repo'
import {getRepositoryPath} from '../src/projects/repo'
import {removeWorktree} from '../src/ports/worktree'

describe('tasks/cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        branchLocal.mockReset()
        deleteLocalBranch.mockReset()
        checkout.mockReset()
    })

    it('removes worktree and branch when a Done card has an attempt', async () => {
        ;(getAttemptForCard as any).mockResolvedValue({
            id: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            agent: 'X',
            status: 'succeeded',
            baseBranch: 'main',
            branchName: 'feature/done',
            worktreePath: '/tmp/wt',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        ;(getRepositoryPath as any).mockResolvedValue('/repo/path')
        branchLocal.mockResolvedValue({all: ['main', 'feature/done'], current: 'main'})

        const result = await cleanupCardWorkspace('board-1', 'card-1')

        expect(result).toEqual({worktreeRemoved: true, branchRemoved: true})
        expect(removeWorktree).toHaveBeenCalledWith('/repo/path', '/tmp/wt', {
            projectId: 'board-1',
            attemptId: 'att-1',
        })
        expect(deleteLocalBranch).toHaveBeenCalledWith('feature/done', true)
        expect(updateAttempt).toHaveBeenCalledWith('att-1', expect.objectContaining({worktreePath: null}))
    })

    it('skips branch deletion when attempt branch matches base branch', async () => {
        ;(getAttemptForCard as any).mockResolvedValue({
            id: 'att-2',
            boardId: 'board-1',
            cardId: 'card-1',
            agent: 'X',
            status: 'succeeded',
            baseBranch: 'main',
            branchName: 'main',
            worktreePath: '/tmp/wt2',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        ;(getRepositoryPath as any).mockResolvedValue('/repo/path')

        const result = await cleanupCardWorkspace('board-1', 'card-1')

        expect(result).toEqual({worktreeRemoved: true, branchRemoved: false})
        expect(removeWorktree).toHaveBeenCalledWith('/repo/path', '/tmp/wt2', {
            projectId: 'board-1',
            attemptId: 'att-2',
        })
        expect(branchLocal).not.toHaveBeenCalled()
        expect(deleteLocalBranch).not.toHaveBeenCalled()
    })
})
