import os from 'os'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ensureGitRepository, getGitOriginUrl, parseGithubOwnerRepo} from '../src/fs/git'

const hoisted = vi.hoisted(() => ({
    mkdir: vi.fn(),
    discover: vi.fn(),
    simpleGit: vi.fn(),
}))

const mkdirMock = hoisted.mkdir
const discoverMock = hoisted.discover
const simpleGitFactory = hoisted.simpleGit

vi.mock('fs/promises', () => ({
    mkdir: (...args: unknown[]) => mkdirMock(...(args as Parameters<typeof mkdirMock>)),
}))

vi.mock('../src/fs/repos', () => ({
    discoverGitRepositories: (...args: unknown[]) => discoverMock(...(args as Parameters<typeof discoverMock>)),
}))

vi.mock('simple-git', () => ({
    default: (...args: unknown[]) => simpleGitFactory(...args),
}))

describe('fs/git', () => {
    beforeEach(() => {
        mkdirMock.mockReset()
        discoverMock.mockReset()
        simpleGitFactory.mockReset()
    })

    it('initializes repo when requested and path uses tilde expansion', async () => {
        const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue('/home/dev')
        const checkIsRepo = vi.fn().mockResolvedValue(false)
        const init = vi.fn().mockResolvedValue(undefined)

        simpleGitFactory.mockReturnValue({
            checkIsRepo,
            init,
            raw: vi.fn(),
        })

        const result = await ensureGitRepository('~/project', true)

        expect(result).toBe('/home/dev/project')
        expect(mkdirMock).toHaveBeenCalledWith('/home/dev/project', {recursive: true})
        expect(checkIsRepo).toHaveBeenCalled()
        expect(init).toHaveBeenCalled()
        homedirSpy.mockRestore()
    })

    it('verifies existing repo when initialize is false', async () => {
        discoverMock.mockResolvedValue([{name: 'repo', path: '/projects/repo'}])

        const result = await ensureGitRepository('/projects/repo', false)

        expect(result).toBe('/projects/repo')
        expect(discoverMock).toHaveBeenCalledWith({basePath: '/projects/repo', limit: 1, maxDepth: 1})
        expect(mkdirMock).not.toHaveBeenCalled()
    })

    it('throws when directory is not a git repository', async () => {
        discoverMock.mockResolvedValue([])

        await expect(ensureGitRepository('/tmp/not-repo', false)).rejects.toThrowError(
            'The selected directory is not a git repository',
        )
    })

    it('retrieves origin url and trims value', async () => {
        const raw = vi.fn().mockResolvedValue(' https://github.com/org/repo.git \n')
        simpleGitFactory.mockReturnValue({raw})

        const origin = await getGitOriginUrl('/projects/repo')

        expect(origin).toBe('https://github.com/org/repo.git')
        expect(raw).toHaveBeenCalledWith(['config', '--get', 'remote.origin.url'])
    })

    it('returns null when origin lookup fails', async () => {
        const raw = vi.fn().mockRejectedValue(new Error('fail'))
        simpleGitFactory.mockReturnValue({raw})

        const origin = await getGitOriginUrl('/projects/repo')

        expect(origin).toBeNull()
    })

    it('parses github owner and repo from ssh and https urls', () => {
        expect(parseGithubOwnerRepo('git@github.com:owner/repo.git')).toEqual({owner: 'owner', repo: 'repo'})
        expect(parseGithubOwnerRepo('https://github.com/owner/repo')).toEqual({owner: 'owner', repo: 'repo'})
        expect(parseGithubOwnerRepo('https://example.com/owner/repo')).toBeNull()
        expect(parseGithubOwnerRepo('git@github.com:owner')).toBeNull()
    })
})
