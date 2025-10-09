import {mkdir} from 'fs/promises'
import {resolve, join} from 'path'
import os from 'os'
import {discoverGitRepositories} from './repos'
import simpleGit from 'simple-git'

function expandHome(path: string) {
    if (path.startsWith('~')) {
        const home = os.homedir()
        return home ? join(home, path.slice(1)) : path
    }
    return path
}

async function pathContainsGitRepo(path: string) {
    const repos = await discoverGitRepositories({basePath: path, limit: 1, maxDepth: 1})
    return repos.some((entry) => entry.path === resolve(path))
}

export async function ensureGitRepository(pathInput: string, initialize: boolean): Promise<string> {
    if (!pathInput?.trim()) {
        throw new Error('Repository path is required')
    }
    const expanded = expandHome(pathInput.trim())
    const fullPath = resolve(expanded)

    if (initialize) {
        await mkdir(fullPath, {recursive: true})
        const git = simpleGit({baseDir: fullPath})
        const hasGit = await git.checkIsRepo()
        if (!hasGit) {
            await git.init()
        }
        return fullPath
    }

    const hasGit = await pathContainsGitRepo(fullPath)
    if (!hasGit) {
        throw new Error('The selected directory is not a git repository')
    }
    return fullPath
}

export async function getGitOriginUrl(repoPath: string): Promise<string | null> {
    try {
        const git = simpleGit({baseDir: repoPath})
        const value = await git.raw(['config', '--get', 'remote.origin.url'])
        const trimmed = value.trim()
        return trimmed.length ? trimmed : null
    } catch {
        return null
    }
}

export function parseGithubOwnerRepo(originUrl: string): { owner: string; repo: string } | null {
    try {
        const ssh = originUrl.match(/^git@([^:]+):(.+)$/)
        let host = ''
        let path = ''
        if (ssh) {
            host = ssh[1] ?? ''
            path = ssh[2] ?? ''
        } else {
            const url = new URL(originUrl.replace('git+ssh://', 'ssh://'))
            host = url.host
            path = url.pathname.replace(/^\//, '')
        }
        if (!/github\.com$/i.test(host)) return null
        const cleaned = path.replace(/\.git$/i, '')
        const [owner, repo] = cleaned.split('/')
        if (!owner || !repo) return null
        return {owner, repo}
    } catch {
        return null
    }
}

