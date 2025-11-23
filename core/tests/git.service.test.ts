import {beforeEach, describe, expect, it, vi} from 'vitest'

const gitInstances = new Map<string, ReturnType<typeof createGitMock>>()
const simpleGitFactory = vi.fn((options: { baseDir: string }) => {
    const baseDir = options?.baseDir ?? '<unknown>'
    if (!gitInstances.has(baseDir)) {
        gitInstances.set(baseDir, createGitMock(baseDir))
    }
    return gitInstances.get(baseDir)!
})

const getRepositoryPathMock = vi.fn()
const snapshotMock = vi.fn()
const readFileMock = vi.fn()

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
    default: (options: { baseDir: string }) => simpleGitFactory(options),
}))

vi.mock('../src/projects/repo', () => ({
    getRepositoryPath: getRepositoryPathMock,
}))

vi.mock('../src/settings/service', () => ({
    settingsService: {
        snapshot: () => snapshotMock(),
    },
}))

vi.mock('fs', () => ({
    promises: {
        readFile: (...args: unknown[]) => readFileMock(...args),
    },
}))

async function loadService() {
    return import('../src/git/service')
}

beforeEach(() => {
    vi.resetModules()
    gitInstances.clear()
    simpleGitFactory.mockClear()
    getRepositoryPathMock.mockReset()
    snapshotMock.mockReset()
    readFileMock.mockReset()
})

describe('git/service basic operations', () => {
    it('resolves repository path or throws when missing', async () => {
        const {getRepoPath} = await loadService()

        getRepositoryPathMock.mockResolvedValueOnce('/repos/app')
        await expect(getRepoPath('proj-2')).resolves.toBe('/repos/app')

        getRepositoryPathMock.mockResolvedValueOnce(null)
        await expect(getRepoPath('missing')).rejects.toThrowError('Project not found')
    })

    it('ensures git author identity and writes config', async () => {
        const {ensureGitAuthorIdentity} = await loadService()
        snapshotMock.mockReturnValue({
            gitUserName: '  Jane Dev  ',
            gitUserEmail: ' dev@example.com ',
        })

        const git = {
            raw: vi.fn().mockResolvedValue(''),
        }

        const identity = await ensureGitAuthorIdentity(git as any)

        expect(identity).toEqual({name: 'Jane Dev', email: 'dev@example.com'})
        expect(git.raw).toHaveBeenCalledWith(['config', 'user.name', 'Jane Dev'])
        expect(git.raw).toHaveBeenCalledWith(['config', 'user.email', 'dev@example.com'])
    })

    it('throws when git identity cannot be determined', async () => {
        const {ensureGitAuthorIdentity} = await loadService()
        snapshotMock.mockReturnValue({
            gitUserName: null,
            gitUserEmail: null,
        })
        const git = {
            raw: vi.fn().mockResolvedValue(''),
        }

        await expect(ensureGitAuthorIdentity(git as any)).rejects.toThrowError(
            'Git defaults missing: set user name and email in App Settings or via git config before committing',
        )
    })
})

describe('git/service repository status and content', () => {
    it('computes repository status with ahead/behind counts', async () => {
        const {getStatus} = await loadService()
        getRepositoryPathMock.mockResolvedValue('/repos/app')
        const git = createGitMock('/repos/app')
        git.status.mockResolvedValue({
            current: 'main',
            tracking: 'origin/main',
            created: ['foo'],
            modified: ['bar'],
            deleted: [],
            not_added: ['baz'],
            files: [
                {path: 'foo', index: 'A', working_dir: ' ', from: undefined},
                {path: 'bar', index: ' ', working_dir: 'M', from: undefined},
            ],
        } as any)
        git.raw.mockResolvedValue('1\t2')
        gitInstances.set('/repos/app', git)

        const status = await getStatus('proj-3')

        expect(status.branch).toBe('main')
        expect(status.ahead).toBe(2)
        expect(status.behind).toBe(1)
        expect(status.summary).toMatchObject({added: 1, modified: 1, untracked: 1, staged: 1})
    })

    it('provides diff and staging helpers', async () => {
        const {getDiff, stageFiles, unstageFiles} = await loadService()
        getRepositoryPathMock.mockResolvedValue('/repos/app')
        const git = createGitMock('/repos/app')
        git.diff.mockResolvedValue('diff-content')
        gitInstances.set('/repos/app', git)

        const diff = await getDiff('proj', 'src/index.ts')
        expect(diff).toBe('diff-content')
        expect(git.diff).toHaveBeenCalledWith(['--', 'src/index.ts'])

        await stageFiles('proj', ['a.ts', 'b.ts'])
        expect(git.add).toHaveBeenCalledWith(['a.ts', 'b.ts'])

        await unstageFiles('proj', ['a.ts'])
        expect(git.raw).toHaveBeenCalledWith(['reset', '-q', 'HEAD', '--', 'a.ts'])
    })

    it('commits and pushes with appropriate arguments', async () => {
        const {commit, push} = await loadService()
        snapshotMock.mockReturnValue({
            gitUserName: 'Jane',
            gitUserEmail: 'jane@example.com',
        })
        getRepositoryPathMock.mockResolvedValue('/repos/app')
        const git = createGitMock('/repos/app')
        git.commit.mockResolvedValue({commit: '123abc4'})
        git.revparse
            .mockResolvedValueOnce('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
            .mockResolvedValueOnce('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
        git.status.mockResolvedValue({current: 'feature', tracking: 'origin/feature'} as any)
        git.raw.mockResolvedValue('0\t0')
        gitInstances.set('/repos/app', git)

        const hash = await commit('proj', ' Test commit ')
        expect(hash).toBe('123abc4')
        expect(git.add).toHaveBeenCalledWith(['-A'])
        expect(git.commit).toHaveBeenCalledWith('Test commit')

        await push('proj', {token: 'secret', setUpstream: true})
        expect(git.raw).toHaveBeenCalledWith([
            '-c',
            'http.extraHeader=Authorization: Basic eC1hY2Nlc3MtdG9rZW46c2VjcmV0',
            'push',
            '-u',
            'origin',
            'feature',
        ])

        await push('proj', {remote: 'upstream', branch: 'main'})
        expect(git.raw).toHaveBeenCalledWith([
            'push',
            'upstream',
            'main',
        ])
    })

    it('reads file content from different sources', async () => {
        const {getFileContent} = await loadService()
        getRepositoryPathMock.mockResolvedValue('/repos/app')
        readFileMock.mockResolvedValue(Buffer.from('hello world'))
        const git = createGitMock('/repos/app')
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'show') {
                const target = args[1]
                if (target === ':README.md') return 'index-content'
                if (target === 'HEAD:README.md') return 'head-content'
                if (target?.startsWith('origin/main:')) return ''
            }
            return ''
        })
        gitInstances.set('/repos/app', git)

        const worktree = await getFileContent('proj', 'README.md', 'worktree')
        expect(worktree).toBe('hello world')

        const index = await getFileContent('proj', 'README.md', 'index')
        expect(index).toBe('index-content')
        expect(git.raw).toHaveBeenCalledWith(['show', ':README.md'])

        const head = await getFileContent('proj', 'README.md', 'head')
        expect(head).toBe('head-content')
        expect(git.raw).toHaveBeenCalledWith(['show', 'HEAD:README.md'])

        const base = await getFileContent('proj', 'README.md', 'base', 'origin/main')
        expect(base).toBeNull()

        const unknown = await getFileContent('proj', 'README.md', 'headless' as any)
        expect(unknown).toBeNull()
    })
})

describe('git/service helpers for worktree paths', () => {
    it('resolves base refs and ancestors', async () => {
        const {resolveBaseRefAtPath, resolveBaseAncestorAtPath} = await loadService()
        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({current: 'feature', tracking: 'origin/main'} as any)
        git.raw.mockResolvedValue('abc123')
        gitInstances.set('/tmp/work', git)

        const ref = await resolveBaseRefAtPath('/tmp/work', 'develop', 'upstream')
        expect(ref).toBe('upstream/develop')

        const ancestor = await resolveBaseAncestorAtPath('/tmp/work', 'develop', 'upstream')
        expect(ancestor).toBe('abc123')
    })

    it('computes status against base and reads file variants', async () => {
        const {getStatusAgainstBaseAtPath, getFileContentAtPath} = await loadService()
        const git = createGitMock('/tmp/work')
        git.status.mockResolvedValue({
            current: 'feature',
            tracking: 'origin/feature',
            created: [],
            modified: [],
            deleted: [],
            not_added: ['c.txt'],
            files: [
                {path: 'a.txt', index: ' ', working_dir: 'M', from: undefined},
                {path: 'b.txt', index: 'A', working_dir: ' ', from: undefined},
                {path: 'new.txt', index: 'R', working_dir: ' ', from: 'old.txt'},
            ],
        } as any)
        git.raw.mockImplementation(async (args: string[]) => {
            if (args[0] === 'rev-list') {
                return '0\t3'
            }
            if (args[0] === 'diff') {
                // Simulate `git diff --name-status -z`
                return [
                    'M', 'a.txt',
                    'A', 'b.txt',
                    'R100', 'old.txt', 'new.txt',
                    'C100', 'src', ' new-with-space.txt ',
                    'A', ' spaced-leading.txt',
                ].join('\0') + '\0'
            }
            if (args[0] === 'show') {
                const target = args[1]
                if (target === ':a.txt') return 'index-content'
                if (target === 'HEAD:a.txt') return 'head-content'
                if (target?.includes(':a.txt')) return ''
            }
            return ''
        })
        readFileMock.mockResolvedValue(Buffer.from('local'))
        gitInstances.set('/tmp/work', git)

        const status = await getStatusAgainstBaseAtPath('/tmp/work', 'base-ref')
        expect(status.ahead).toBe(3)
        expect(status.behind).toBe(0)
        const expectedFiles = [
            {path: 'a.txt', status: 'M', staged: false},
            {path: 'b.txt', status: 'A', staged: true},
            {path: ' spaced-leading.txt', status: 'A', staged: false},
            {path: 'c.txt', status: '?', staged: false},
            {path: 'new.txt', oldPath: 'old.txt', status: 'R', staged: true},
            {path: ' new-with-space.txt ', oldPath: 'src', status: 'C', staged: false},
        ]
        const sortByPath = (a: any, b: any) => a.path.localeCompare(b.path)
        expect(status.files.slice().sort(sortByPath)).toEqual(expectedFiles.sort(sortByPath))
        expect(status.summary).toMatchObject({added: 3, modified: 2, untracked: 1, staged: 2})
        expect(status.hasUncommitted).toBe(true)

        const worktree = await getFileContentAtPath('/tmp/work', 'a.txt', 'worktree')
        expect(worktree).toBe('local')

        const index = await getFileContentAtPath('/tmp/work', 'a.txt', 'index')
        expect(index).toBe('index-content')
        expect(git.raw).toHaveBeenCalledWith(['show', ':a.txt'])

        const head = await getFileContentAtPath('/tmp/work', 'a.txt', 'head')
        expect(head).toBe('head-content')
        expect(git.raw).toHaveBeenCalledWith(['show', 'HEAD:a.txt'])

        const base = await getFileContentAtPath('/tmp/work', 'a.txt', 'base', 'origin/main')
        expect(base).toBeNull()
    })

    it('publishes events for commit and push operations', async () => {
        const {bindGitEventBus, commitAtPath, pushAtPath, mergeBranchIntoBaseForProject} = await loadService()

        snapshotMock.mockReturnValue({
            gitUserName: 'Jane',
            gitUserEmail: 'jane@example.com',
        })

        const git = createGitMock('/tmp/work')
        git.commit.mockResolvedValue({commit: 'abcdef1'})
        git.revparse
            .mockResolvedValueOnce('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
            .mockResolvedValueOnce('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
        git.status.mockResolvedValue({current: 'feature', tracking: 'origin/feature'} as any)
        git.raw.mockResolvedValue('0\t0')
        gitInstances.set('/tmp/work', git)

        const bus = {publish: vi.fn()}
        bindGitEventBus(bus as any)

        await commitAtPath('/tmp/work', 'Commit message', undefined, {projectId: 'proj', attemptId: 'att'})
        await pushAtPath('/tmp/work', {setUpstream: true}, {projectId: 'proj', attemptId: 'att'})

        expect(bus.publish).toHaveBeenCalledWith('git.status.changed', {projectId: 'proj'})
        expect(bus.publish).toHaveBeenCalledWith(
            'git.commit.created',
            expect.objectContaining({projectId: 'proj', attemptId: 'att', shortSha: 'abcdef1'}),
        )
        expect(bus.publish).toHaveBeenCalledWith(
            'git.push.completed',
            expect.objectContaining({projectId: 'proj', attemptId: 'att'}),
        )

        await expect(
            mergeBranchIntoBaseForProject('proj', {remote: 'origin', baseBranch: 'main', headBranch: 'feature'}),
        ).resolves.toBe(true)
    })
})
