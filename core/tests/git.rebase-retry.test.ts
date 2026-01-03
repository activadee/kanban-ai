import {beforeEach, describe, expect, it, vi} from 'vitest'

const gitInstances = new Map<string, ReturnType<typeof createGitMock>>()
const simpleGitFactory = vi.fn((options: {baseDir: string}) => {
    const baseDir = options?.baseDir ?? '<unknown>'
    if (!gitInstances.has(baseDir)) {
        gitInstances.set(baseDir, createGitMock(baseDir))
    }
    return gitInstances.get(baseDir)!
})

const insertAttemptLogMock = vi.fn()
const listConversationItemsDescendingMock = vi.fn()
const getCardByIdMock = vi.fn()

function createGitMock(baseDir: string) {
    return {
        baseDir,
        status: vi.fn(),
        raw: vi.fn(),
        diff: vi.fn(),
        add: vi.fn(),
        commit: vi.fn(),
        revparse: vi.fn(),
        push: vi.fn(),
    }
}

vi.mock('simple-git', () => ({
    default: (options: {baseDir: string}) => simpleGitFactory(options),
}))

vi.mock('../src/attempts/repo', () => ({
    insertAttemptLog: insertAttemptLogMock,
    listConversationItemsDescending: listConversationItemsDescendingMock,
}))

vi.mock('../src/projects/repo', () => ({
    getCardById: getCardByIdMock,
    getRepositoryPath: vi.fn(),
}))

vi.mock('../src/settings/service', () => ({
    settingsService: {
        snapshot: () => ({
            gitUserName: 'Test User',
            gitUserEmail: 'test@example.com',
        }),
    },
}))

beforeEach(() => {
    gitInstances.clear()
    simpleGitFactory.mockClear()
    insertAttemptLogMock.mockReset()
    listConversationItemsDescendingMock.mockReset()
    getCardByIdMock.mockReset()
})

describe('git/worktree-service rebase operations', () => {
    it('isPushConflictError detects push conflicts correctly', async () => {
        const {isPushConflictError} = await import('../src/git/worktree-service')

        const conflictError1 = new Error('rejected - non-fast-forward')
        expect(isPushConflictError(conflictError1)).toBe(true)

        const conflictError2 = new Error('failed to push some refs - updates were rejected')
        expect(isPushConflictError(conflictError2)).toBe(true)

        const conflictError3 = new Error('fetch first')
        expect(isPushConflictError(conflictError3)).toBe(true)

        const conflictError4 = Object.assign(new Error('push failed'), {
            stderr: '[rejected] main -> main (non-fast-forward)',
        })
        expect(isPushConflictError(conflictError4)).toBe(true)

        const nonConflictError = new Error('network error')
        expect(isPushConflictError(nonConflictError)).toBe(false)
    })

    it('pullRebaseAtPath succeeds when rebase completes without conflicts', async () => {
        const {pullRebaseAtPath} = await import('../src/git/worktree-service')

        const git = createGitMock('/tmp/work')
        git.raw.mockResolvedValue('')
        gitInstances.set('/tmp/work', git)

        const result = await pullRebaseAtPath('/tmp/work')

        expect(result).toEqual({
            success: true,
            hasConflicts: false,
            message: 'Rebase completed successfully',
        })
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
    })

    it('pullRebaseAtPath detects conflicts and aborts rebase', async () => {
        const {pullRebaseAtPath} = await import('../src/git/worktree-service')

        const git = createGitMock('/tmp/work')
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'pull' && args[1] === '--rebase') {
                const error = Object.assign(new Error('CONFLICT: content conflict in file.txt'), {
                    stderr: 'CONFLICT (content): Merge conflict in file.txt\nResolve all conflicts',
                })
                throw error
            }
            if (args[0] === 'rebase' && args[1] === '--abort') {
                return ''
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        const result = await pullRebaseAtPath('/tmp/work')

        expect(result).toEqual({
            success: false,
            hasConflicts: true,
            message: 'Rebase has conflicts and was aborted',
        })
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(git.raw).toHaveBeenCalledWith(['rebase', '--abort'])
    })

    it('pullRebaseAtPath recovers with reset when abort fails', async () => {
        const {pullRebaseAtPath} = await import('../src/git/worktree-service')

        const git = createGitMock('/tmp/work')
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'pull' && args[1] === '--rebase') {
                const error = Object.assign(new Error('CONFLICT: content conflict in file.txt'), {
                    stderr: 'CONFLICT (content): Merge conflict in file.txt',
                })
                throw error
            }
            if (args[0] === 'rebase' && args[1] === '--abort') {
                throw new Error('fatal: could not abort rebase')
            }
            return ''
        })
        git.status.mockResolvedValue({
            conflicted: [],
            modified: [],
            created: [],
            deleted: [],
            renamed: [],
        })
        gitInstances.set('/tmp/work', git)

        const result = await pullRebaseAtPath('/tmp/work')

        expect(result.success).toBe(false)
        expect(result.hasConflicts).toBe(true)
        expect(result.message).toContain('Rebase abort failed but repository was reset to clean state')
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(git.raw).toHaveBeenCalledWith(['rebase', '--abort'])
        expect(git.raw).toHaveBeenCalledWith(['reset', '--hard', 'HEAD'])
        expect(git.raw).toHaveBeenCalledWith(['clean', '-fd'])
        expect(git.status).toHaveBeenCalled()
    })

    it('pullRebaseAtPath detects when reset succeeds but repository is still not clean', async () => {
        const {pullRebaseAtPath} = await import('../src/git/worktree-service')

        const git = createGitMock('/tmp/work')
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'pull' && args[1] === '--rebase') {
                const error = Object.assign(new Error('CONFLICT: content conflict in file.txt'), {
                    stderr: 'CONFLICT (content): Merge conflict in file.txt',
                })
                throw error
            }
            if (args[0] === 'rebase' && args[1] === '--abort') {
                throw new Error('fatal: could not abort rebase')
            }
            return ''
        })
        git.status.mockResolvedValue({
            conflicted: [],
            modified: ['file1.txt'],
            created: [],
            deleted: [],
            renamed: [],
        })
        gitInstances.set('/tmp/work', git)

        const result = await pullRebaseAtPath('/tmp/work')

        expect(result.success).toBe(false)
        expect(result.hasConflicts).toBe(true)
        expect(result.message).toContain('Reset completed but repository still has uncommitted changes')
        expect(result.message).toContain('Manual intervention required')
        expect(git.status).toHaveBeenCalled()
    })

    it('pullRebaseAtPath returns error when both abort and reset fail', async () => {
        const {pullRebaseAtPath} = await import('../src/git/worktree-service')

        const git = createGitMock('/tmp/work')
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'pull' && args[1] === '--rebase') {
                const error = Object.assign(new Error('CONFLICT: content conflict in file.txt'), {
                    stderr: 'CONFLICT (content): Merge conflict in file.txt',
                })
                throw error
            }
            if (args[0] === 'rebase' && args[1] === '--abort') {
                throw new Error('fatal: could not abort rebase')
            }
            if (args[0] === 'reset') {
                throw new Error('fatal: could not reset')
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        const result = await pullRebaseAtPath('/tmp/work')

        expect(result.success).toBe(false)
        expect(result.hasConflicts).toBe(true)
        expect(result.message).toContain('Failed to abort rebase after conflicts detected')
        expect(result.message).toContain('Manual intervention required')
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(git.raw).toHaveBeenCalledWith(['rebase', '--abort'])
        expect(git.raw).toHaveBeenCalledWith(['reset', '--hard', 'HEAD'])
    })

    it('pullRebaseAtPath handles non-conflict rebase errors', async () => {
        const {pullRebaseAtPath} = await import('../src/git/worktree-service')

        const git = createGitMock('/tmp/work')
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'pull' && args[1] === '--rebase') {
                throw new Error('network error: connection timeout')
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        const result = await pullRebaseAtPath('/tmp/work')

        expect(result.success).toBe(false)
        expect(result.hasConflicts).toBe(false)
        expect(result.message).toContain('network error')
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(git.raw).not.toHaveBeenCalledWith(['rebase', '--abort'])
    })
})

describe('autocommit with rebase retry', () => {
    it('push succeeds on first try - no retry needed', async () => {
        const {performAutoCommit} = await import('../src/attempts/autocommit')

        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({
            current: 'feature',
            tracking: 'origin/feature',
            files: [{path: 'test.txt', index: 'M', working_dir: ' ', from: undefined}],
            created: [],
            modified: ['test.txt'],
            deleted: [],
            not_added: [],
        } as any)
        git.add.mockResolvedValue(undefined)
        git.commit.mockResolvedValue({
            commit: 'abc123',
            summary: {changes: 1, insertions: 5, deletions: 2},
        })
        git.revparse.mockResolvedValue('abc123')
        git.raw.mockResolvedValue('')
        gitInstances.set('/tmp/work', git)

        listConversationItemsDescendingMock.mockResolvedValue([])
        getCardByIdMock.mockResolvedValue({title: 'Test Card'})

        const events = {
            publish: vi.fn(),
        }

        await performAutoCommit({
            attemptId: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            worktreePath: '/tmp/work',
            autoPushOnAutocommit: true,
            preferredRemote: 'origin',
            events: events as any,
        })

        expect(git.raw).toHaveBeenCalledWith(['push', 'origin', 'feature'])
        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] pushed'),
            })
        )
        expect(events.publish).not.toHaveBeenCalledWith(
            'git.rebase.started',
            expect.anything()
        )
    })

    it('push fails with conflict, rebase succeeds, retry push succeeds', async () => {
        const {performAutoCommit} = await import('../src/attempts/autocommit')

        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({
            current: 'feature',
            tracking: 'origin/feature',
            files: [{path: 'test.txt', index: 'M', working_dir: ' ', from: undefined}],
            created: [],
            modified: ['test.txt'],
            deleted: [],
            not_added: [],
        } as any)
        git.add.mockResolvedValue(undefined)
        git.commit.mockResolvedValue({
            commit: 'abc123',
            summary: {changes: 1, insertions: 5, deletions: 2},
        })
        git.revparse.mockResolvedValue('abc123')

        let pushCallCount = 0
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'push') {
                pushCallCount++
                if (pushCallCount === 1) {
                    const error = Object.assign(
                        new Error('rejected - non-fast-forward'),
                        {stderr: '[rejected] feature -> feature (non-fast-forward)'}
                    )
                    throw error
                }
                return ''
            }
            if (args[0] === 'pull' && args[1] === '--rebase') {
                return ''
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        listConversationItemsDescendingMock.mockResolvedValue([])
        getCardByIdMock.mockResolvedValue({title: 'Test Card'})

        const events = {
            publish: vi.fn(),
        }

        await performAutoCommit({
            attemptId: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            worktreePath: '/tmp/work',
            autoPushOnAutocommit: true,
            preferredRemote: 'origin',
            events: events as any,
        })

        expect(git.raw).toHaveBeenCalledWith(['push', 'origin', 'feature'])
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(pushCallCount).toBe(2)

        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] push conflict detected'),
            })
        )
        expect(events.publish).toHaveBeenCalledWith('git.rebase.started', expect.anything())
        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] rebase successful'),
            })
        )
        expect(events.publish).toHaveBeenCalledWith('git.rebase.completed', expect.anything())
        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] push succeeded after rebase'),
            })
        )
        expect(events.publish).toHaveBeenCalledWith('git.push.retried', expect.anything())
    })

    it('push fails with conflict, rebase has conflicts, graceful abort', async () => {
        const {performAutoCommit} = await import('../src/attempts/autocommit')

        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({
            current: 'feature',
            tracking: 'origin/feature',
            files: [{path: 'test.txt', index: 'M', working_dir: ' ', from: undefined}],
            created: [],
            modified: ['test.txt'],
            deleted: [],
            not_added: [],
        } as any)
        git.add.mockResolvedValue(undefined)
        git.commit.mockResolvedValue({
            commit: 'abc123',
            summary: {changes: 1, insertions: 5, deletions: 2},
        })
        git.revparse.mockResolvedValue('abc123')

        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'push') {
                const error = Object.assign(
                    new Error('rejected - non-fast-forward'),
                    {stderr: '[rejected] feature -> feature (non-fast-forward)'}
                )
                throw error
            }
            if (args[0] === 'pull' && args[1] === '--rebase') {
                const error = Object.assign(
                    new Error('CONFLICT: content conflict in file.txt'),
                    {stderr: 'CONFLICT (content): Merge conflict in file.txt'}
                )
                throw error
            }
            if (args[0] === 'rebase' && args[1] === '--abort') {
                return ''
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        listConversationItemsDescendingMock.mockResolvedValue([])
        getCardByIdMock.mockResolvedValue({title: 'Test Card'})

        const events = {
            publish: vi.fn(),
        }

        await performAutoCommit({
            attemptId: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            worktreePath: '/tmp/work',
            autoPushOnAutocommit: true,
            preferredRemote: 'origin',
            events: events as any,
        })

        expect(git.raw).toHaveBeenCalledWith(['push', 'origin', 'feature'])
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(git.raw).toHaveBeenCalledWith(['rebase', '--abort'])

        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] push conflict detected'),
            })
        )
        expect(events.publish).toHaveBeenCalledWith('git.rebase.started', expect.anything())
        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] rebase conflicts detected'),
            })
        )
        expect(events.publish).toHaveBeenCalledWith(
            'git.rebase.aborted',
            expect.objectContaining({reason: 'conflicts'})
        )
        expect(events.publish).not.toHaveBeenCalledWith('git.push.retried', expect.anything())
    })

    it('non-conflict push error - no retry attempt', async () => {
        const {performAutoCommit} = await import('../src/attempts/autocommit')

        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({
            current: 'feature',
            tracking: 'origin/feature',
            files: [{path: 'test.txt', index: 'M', working_dir: ' ', from: undefined}],
            created: [],
            modified: ['test.txt'],
            deleted: [],
            not_added: [],
        } as any)
        git.add.mockResolvedValue(undefined)
        git.commit.mockResolvedValue({
            commit: 'abc123',
            summary: {changes: 1, insertions: 5, deletions: 2},
        })
        git.revparse.mockResolvedValue('abc123')

        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'push') {
                throw new Error('network error: connection timeout')
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        listConversationItemsDescendingMock.mockResolvedValue([])
        getCardByIdMock.mockResolvedValue({title: 'Test Card'})

        const events = {
            publish: vi.fn(),
        }

        await performAutoCommit({
            attemptId: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            worktreePath: '/tmp/work',
            autoPushOnAutocommit: true,
            preferredRemote: 'origin',
            events: events as any,
        })

        expect(git.raw).toHaveBeenCalledWith(['push', 'origin', 'feature'])
        expect(git.raw).not.toHaveBeenCalledWith(['pull', '--rebase'])

        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] failed: network error'),
                level: 'error',
            })
        )
        expect(events.publish).not.toHaveBeenCalledWith('git.rebase.started', expect.anything())
    })

    it('push retry fails after successful rebase - logs warning but does not throw', async () => {
        const {performAutoCommit} = await import('../src/attempts/autocommit')

        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({
            current: 'feature',
            tracking: 'origin/feature',
            files: [{path: 'test.txt', index: 'M', working_dir: ' ', from: undefined}],
            created: [],
            modified: ['test.txt'],
            deleted: [],
            not_added: [],
        } as any)
        git.add.mockResolvedValue(undefined)
        git.commit.mockResolvedValue({
            commit: 'abc123',
            summary: {changes: 1, insertions: 5, deletions: 2},
        })
        git.revparse.mockResolvedValue('abc123')

        let pushCallCount = 0
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'push') {
                pushCallCount++
                if (pushCallCount === 1) {
                    const error = Object.assign(
                        new Error('rejected - non-fast-forward'),
                        {stderr: '[rejected] feature -> feature (non-fast-forward)'}
                    )
                    throw error
                }
                throw new Error('network error during retry')
            }
            if (args[0] === 'pull' && args[1] === '--rebase') {
                return ''
            }
            return ''
        })
        gitInstances.set('/tmp/work', git)

        listConversationItemsDescendingMock.mockResolvedValue([])
        getCardByIdMock.mockResolvedValue({title: 'Test Card'})

        const events = {
            publish: vi.fn(),
        }

        await performAutoCommit({
            attemptId: 'att-1',
            boardId: 'board-1',
            cardId: 'card-1',
            worktreePath: '/tmp/work',
            autoPushOnAutocommit: true,
            preferredRemote: 'origin',
            events: events as any,
        })

        expect(git.raw).toHaveBeenCalledWith(['push', 'origin', 'feature'])
        expect(git.raw).toHaveBeenCalledWith(['pull', '--rebase'])
        expect(pushCallCount).toBe(2)

        expect(events.publish).toHaveBeenCalledWith('git.rebase.completed', expect.anything())
        expect(events.publish).toHaveBeenCalledWith(
            'attempt.log.appended',
            expect.objectContaining({
                message: expect.stringContaining('[autopush] push retry failed'),
                level: 'error',
            })
        )
    })
})
