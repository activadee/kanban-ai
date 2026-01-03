import {beforeEach, describe, expect, it, vi} from 'vitest'
import {deleteTrackedWorktree} from '../src/worktrees/worktrees.service'
import {existsSync} from 'fs'

vi.mock('fs', () => ({
    existsSync: vi.fn(),
}))

vi.mock('core', () => ({
    git: {
        deleteBranch: vi.fn(async () => {}),
        deleteRemoteBranch: vi.fn(async () => {}),
    },
}))

vi.mock('../src/log', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

describe('deleteTrackedWorktree', () => {
    const projectId = 'project-1'
    const worktreePath = '/path/to/worktree'
    const branchName = 'feature/test-branch'
    const mockProject = {
        id: 'project-1',
        name: 'test-project',
        repositoryPath: '/path/to/repo',
    }
    const mockDeps = {
        removeWorktreeFromRepo: vi.fn(async () => {}),
        getProject: vi.fn(async () => mockProject),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(existsSync as any).mockReturnValue(true)
        mockDeps.getProject.mockResolvedValue(mockProject)
    })

    it('removes worktree successfully without branch deletion', async () => {
        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps)

        expect(mockDeps.getProject).toHaveBeenCalledWith(projectId)
        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith('/path/to/repo', worktreePath)
        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree removed successfully')
    })

    it('removes worktree and deletes local branch when deleteBranch is true', async () => {
        const {git} = await import('core')

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps, {
            deleteBranch: true,
        })

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith('/path/to/repo', worktreePath)
        expect(git.deleteBranch).toHaveBeenCalledWith(projectId, branchName)
        expect(result.success).toBe(true)
    })

    it('removes worktree and deletes remote branch when deleteRemoteBranch is true', async () => {
        const {git} = await import('core')

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps, {
            deleteRemoteBranch: true,
        })

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith('/path/to/repo', worktreePath)
        expect(git.deleteRemoteBranch).toHaveBeenCalledWith(projectId, branchName)
        expect(result.success).toBe(true)
    })

    it('removes worktree and deletes both branches when both options are true', async () => {
        const {git} = await import('core')

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps, {
            deleteBranch: true,
            deleteRemoteBranch: true,
        })

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith('/path/to/repo', worktreePath)
        expect(git.deleteBranch).toHaveBeenCalledWith(projectId, branchName)
        expect(git.deleteRemoteBranch).toHaveBeenCalledWith(projectId, branchName)
        expect(result.success).toBe(true)
    })

    it('succeeds even if local branch deletion fails', async () => {
        const {git} = await import('core')
        ;(git.deleteBranch as any).mockRejectedValue(new Error('Branch not found'))

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps, {
            deleteBranch: true,
        })

        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree removed successfully')
    })

    it('succeeds even if remote branch deletion fails', async () => {
        const {git} = await import('core')
        ;(git.deleteRemoteBranch as any).mockRejectedValue(new Error('Remote branch not found'))

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps, {
            deleteRemoteBranch: true,
        })

        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree removed successfully')
    })

    it('returns success if worktree does not exist on disk', async () => {
        ;(existsSync as any).mockReturnValue(false)

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps)

        expect(mockDeps.removeWorktreeFromRepo).not.toHaveBeenCalled()
        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree already removed from disk')
    })

    it('returns failure if worktree removal fails', async () => {
        mockDeps.removeWorktreeFromRepo.mockRejectedValue(new Error('Failed to remove worktree'))

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps)

        expect(result.success).toBe(false)
        expect(result.message).toBe('Failed to remove worktree')
    })

    it('returns failure if project not found', async () => {
        mockDeps.getProject.mockResolvedValue(null)

        const result = await deleteTrackedWorktree(projectId, worktreePath, branchName, mockDeps)

        expect(result.success).toBe(false)
        expect(result.message).toBe('Project not found')
        expect(mockDeps.removeWorktreeFromRepo).not.toHaveBeenCalled()
    })
})
