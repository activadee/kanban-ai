import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {Dirent} from 'fs'
import {discoverGitRepositories} from '../src/fs/repos'

const hoisted = vi.hoisted(() => ({
    readdir: vi.fn<Promise<Dirent[]>, [string, { withFileTypes: true } | undefined]>(),
    homedir: vi.fn<() => string | undefined>(),
}))

const readdirMock = hoisted.readdir
const homedirMock = hoisted.homedir

vi.mock('fs/promises', () => ({
    readdir: (path: string, opts?: { withFileTypes: true }) => readdirMock(path, opts as any),
}))

vi.mock('os', () => {
    const homedir = () => homedirMock()
    return {
        default: {homedir},
        homedir,
    }
})

function dir(name: string): Dirent {
    return {
        name,
        isDirectory: () => true,
        isFile: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
    } as Dirent
}

describe('fs/repos', () => {
    beforeEach(() => {
        readdirMock.mockReset()
        homedirMock.mockReset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('discovers git repositories within provided base path', async () => {
        const tree: Record<string, Dirent[]> = {
            '/workspace': [dir('.git'), dir('nested')],
            '/workspace/nested': [dir('child')],
            '/workspace/nested/child': [],
        }

        readdirMock.mockImplementation(async (path) => tree[path] ?? [])

        const repos = await discoverGitRepositories({basePath: '/workspace', limit: 5, maxDepth: 3})

        expect(readdirMock).toHaveBeenCalled()
        expect(repos).toEqual([{name: 'workspace', path: '/workspace'}])
    })

    it('respects skip list and returns sorted unique results', async () => {
        const tree: Record<string, Dirent[]> = {
            '/projects': [dir('repo-b'), dir('node_modules'), dir('repo-a')],
            '/projects/repo-a': [dir('.git')],
            '/projects/repo-b': [dir('.git')],
            '/projects/node_modules': [dir('ignored-repo')],
            '/projects/node_modules/ignored-repo': [dir('.git')],
        }

        readdirMock.mockImplementation(async (path) => tree[path] ?? [])

        const repos = await discoverGitRepositories({basePath: '/projects', limit: 10, maxDepth: 2})

        expect(repos).toEqual([
            {name: 'repo-a', path: '/projects/repo-a'},
            {name: 'repo-b', path: '/projects/repo-b'},
        ])
        const visitedPaths = readdirMock.mock.calls.map(([path]) => path)
        expect(visitedPaths.some((path) => path.includes('node_modules'))).toBe(false)
    })

    it('falls back to default search roots when base path not provided', async () => {
        const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/home/test/work')
        homedirMock.mockReturnValue('/home/test')
        readdirMock.mockResolvedValue([])

        const repos = await discoverGitRepositories()

        expect(repos).toEqual([])
        expect(cwdSpy).toHaveBeenCalled()
        expect(homedirMock).toHaveBeenCalled()
    })
})
