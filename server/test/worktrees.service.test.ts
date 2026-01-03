import {beforeEach, describe, expect, it, vi} from 'vitest'
import {deleteTrackedWorktree} from '../src/worktrees/worktrees.service'
import {existsSync} from 'fs'
import * as childProcess from 'child_process'

vi.mock('fs', () => ({
    existsSync: vi.fn(),
}))

vi.mock('child_process', () => ({
    spawn: vi.fn(),
}))

vi.mock('../src/log', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

const createMockSpawn = (exitCode: number = 0, stdout = '', stderr = '') => {
    const mockChild = {
        stdout: {
            on: vi.fn((event: string, handler: (data: Buffer) => void) => {
                if (event === 'data') {
                    setTimeout(() => handler(Buffer.from(stdout)), 0)
                }
            }),
        },
        stderr: {
            on: vi.fn((event: string, handler: (data: Buffer) => void) => {
                if (event === 'data') {
                    setTimeout(() => handler(Buffer.from(stderr)), 0)
                }
            }),
        },
        on: vi.fn((event: string, handler: (code: number) => void) => {
            if (event === 'exit') {
                setTimeout(() => handler(exitCode), 0)
            }
        }),
    }
    return mockChild as any
}

describe('deleteTrackedWorktree', () => {
    const worktreePath = '/path/to/worktree'
    const repoPath = '/path/to/repo'
    const branchName = 'feature/test-branch'
    const mockDeps = {
        removeWorktreeFromRepo: vi.fn(async () => {}),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(existsSync as any).mockReturnValue(true)
    })

    it('removes worktree successfully without branch deletion', async () => {
        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps)

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith(repoPath, worktreePath)
        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree removed successfully')
    })

    it('removes worktree and deletes local branch when deleteBranch is true', async () => {
        ;(childProcess.spawn as any).mockImplementation((cmd: string, args: string[]) => {
            if (args && args[0] === 'branch' && args[1] === '-D') {
                return createMockSpawn(0, 'Deleted branch feature/test-branch')
            }
            return createMockSpawn(0)
        })

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps, {
            deleteBranch: true,
        })

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith(repoPath, worktreePath)
        expect(childProcess.spawn).toHaveBeenCalledWith('git', ['branch', '-D', branchName], {cwd: repoPath})
        expect(result.success).toBe(true)
    })

    it('removes worktree and deletes remote branch when deleteRemoteBranch is true', async () => {
        ;(childProcess.spawn as any).mockImplementation((cmd: string, args: string[]) => {
            if (args && args[0] === 'push' && args[2] === '--delete') {
                return createMockSpawn(0, 'Deleted remote branch')
            }
            return createMockSpawn(0)
        })

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps, {
            deleteRemoteBranch: true,
        })

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith(repoPath, worktreePath)
        expect(childProcess.spawn).toHaveBeenCalledWith(
            'git',
            ['push', 'origin', '--delete', branchName],
            {cwd: repoPath}
        )
        expect(result.success).toBe(true)
    })

    it('removes worktree and deletes both branches when both options are true', async () => {
        ;(childProcess.spawn as any).mockReturnValue(createMockSpawn(0))

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps, {
            deleteBranch: true,
            deleteRemoteBranch: true,
        })

        expect(mockDeps.removeWorktreeFromRepo).toHaveBeenCalledWith(repoPath, worktreePath)
        expect(childProcess.spawn).toHaveBeenCalledWith('git', ['branch', '-D', branchName], {cwd: repoPath})
        expect(childProcess.spawn).toHaveBeenCalledWith(
            'git',
            ['push', 'origin', '--delete', branchName],
            {cwd: repoPath}
        )
        expect(result.success).toBe(true)
    })

    it('succeeds even if local branch deletion fails', async () => {
        ;(childProcess.spawn as any).mockImplementation((cmd: string, args: string[]) => {
            if (args && args[0] === 'branch' && args[1] === '-D') {
                return createMockSpawn(1, '', 'error: branch not found')
            }
            return createMockSpawn(0)
        })

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps, {
            deleteBranch: true,
        })

        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree removed successfully')
    })

    it('succeeds even if remote branch deletion fails', async () => {
        ;(childProcess.spawn as any).mockImplementation((cmd: string, args: string[]) => {
            if (args && args[0] === 'push' && args[2] === '--delete') {
                return createMockSpawn(1, '', 'error: remote branch not found')
            }
            return createMockSpawn(0)
        })

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps, {
            deleteRemoteBranch: true,
        })

        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree removed successfully')
    })

    it('returns success if worktree does not exist on disk', async () => {
        ;(existsSync as any).mockReturnValue(false)

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps)

        expect(mockDeps.removeWorktreeFromRepo).not.toHaveBeenCalled()
        expect(result.success).toBe(true)
        expect(result.message).toBe('Worktree already removed from disk')
    })

    it('returns failure if worktree removal fails', async () => {
        mockDeps.removeWorktreeFromRepo.mockRejectedValue(new Error('Failed to remove worktree'))

        const result = await deleteTrackedWorktree(worktreePath, repoPath, branchName, mockDeps)

        expect(result.success).toBe(false)
        expect(result.message).toBe('Failed to remove worktree')
    })
})
