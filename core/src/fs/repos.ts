import {readdir} from 'fs/promises'
import {join, basename, resolve} from 'path'
import os from 'os'

export type GitRepositoryEntry = {
    name: string
    path: string
}

const DEFAULT_LIMIT = 40
const DEFAULT_MAX_DEPTH = 3
const SKIP_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.cache',
    'Library',
    'Applications',
    'AppData',
])

async function hasGitFolder(dir: string) {
    try {
        const entries = await readdir(dir, {withFileTypes: true})
        return entries.some((entry) => entry.isDirectory() && entry.name === '.git')
    } catch {
        return false
    }
}

async function walkDirectory(
    dir: string,
    options: { depth: number; limit: number; results: GitRepositoryEntry[]; visited: Set<string> },
): Promise<void> {
    if (options.results.length >= options.limit) return
    let dirEntries
    try {
        dirEntries = await readdir(dir, {withFileTypes: true})
    } catch {
        return
    }

    if (await hasGitFolder(dir)) {
        const repoPath = resolve(dir)
        if (!options.visited.has(repoPath)) {
            options.visited.add(repoPath)
            options.results.push({name: basename(repoPath) || repoPath, path: repoPath})
        }
        return
    }

    if (options.depth <= 0) return

    for (const entry of dirEntries) {
        if (!entry.isDirectory()) continue
        if (SKIP_DIRECTORIES.has(entry.name)) continue
        const nextPath = join(dir, entry.name)
        await walkDirectory(nextPath, {
            depth: options.depth - 1,
            limit: options.limit,
            results: options.results,
            visited: options.visited,
        })
        if (options.results.length >= options.limit) return
    }
}

function defaultSearchRoots(): string[] {
    const roots = new Set<string>()
    const cwd = resolve(process.cwd())
    roots.add(cwd)
    const home = os.homedir()
    if (home) {
        roots.add(home)
        for (const segment of ['projects', 'repos', 'code', 'dev', 'workspace']) {
            roots.add(join(home, segment))
        }
    }
    return Array.from(roots)
}

export async function discoverGitRepositories(options?: {
    basePath?: string | null
    limit?: number
    maxDepth?: number
}): Promise<GitRepositoryEntry[]> {
    const limit = Math.max(1, options?.limit ?? DEFAULT_LIMIT)
    const maxDepth = Math.max(1, options?.maxDepth ?? DEFAULT_MAX_DEPTH)
    const results: GitRepositoryEntry[] = []
    const visited = new Set<string>()
    const roots = options?.basePath ? [options.basePath] : defaultSearchRoots()

    for (const root of roots) {
        await walkDirectory(root, {depth: maxDepth, limit, results, visited})
        if (results.length >= limit) break
    }

    results.sort((a, b) => a.name.localeCompare(b.name))
    return results
}

