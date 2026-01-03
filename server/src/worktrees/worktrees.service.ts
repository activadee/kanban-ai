import {readdir, stat, rm, realpath} from 'fs/promises'
import {join, basename, resolve} from 'path'
import {existsSync} from 'fs'
import {spawn} from 'child_process'
import type {
    TrackedWorktree,
    OrphanedWorktree,
    StaleWorktree,
    WorktreesSummary,
    WorktreesListResponse,
    WorktreesSyncResponse,
    WorktreeDeleteConstraint,
    WorktreeStatus,
} from 'shared'
import {getProjectWorktreeFolder, getWorktreesRoot} from '../fs/paths'
import {log} from '../log'
import {git} from 'core'

function runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise(async (resolvePromise, reject) => {
        const normalizedCwd = await realpath(cwd).catch(() => null)
        const worktreesRoot = await realpath(getWorktreesRoot()).catch(() => getWorktreesRoot())
        
        if (!normalizedCwd || normalizedCwd.includes('..') || !normalizedCwd.startsWith(worktreesRoot + '/')) {
            reject(new Error('Invalid worktree path'))
            return
        }
        
        const child = spawn('git', args, {
            cwd: normalizedCwd,
            shell: false,
            windowsHide: true,
        })
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (d: Buffer) => (stdout += d))
        child.stderr?.on('data', (d: Buffer) => (stderr += d))
        child.on('error', reject)
        child.on('exit', (code: number | null) => {
            if (code === 0) resolvePromise(stdout.trim())
            else {
                const errorMsg = stderr.trim() || `git ${args.join(' ')} exited with code ${code}`
                const fullMsg = stdout.trim() ? `${errorMsg}. stdout: ${stdout.trim()}` : errorMsg
                reject(new Error(fullMsg))
            }
        })
    })
}

async function getDirectorySize(dirPath: string): Promise<number> {
    return new Promise(async (resolvePromise) => {
        const normalized = await realpath(dirPath).catch(() => null)
        const worktreesRoot = await realpath(getWorktreesRoot()).catch(() => getWorktreesRoot())
        
        if (!normalized || normalized.includes('..') || !normalized.startsWith(worktreesRoot + '/')) {
            resolvePromise(0)
            return
        }
        
        let resolved = false
        const child = spawn('du', ['-sb', normalized], {shell: false, windowsHide: true})
        let stdout = ''
        
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true
                child.kill('SIGKILL')
                resolvePromise(0)
            }
        }, 30000)
        
        child.stdout?.on('data', (d) => (stdout += d))
        child.on('error', () => {
            if (!resolved) {
                resolved = true
                clearTimeout(timeoutId)
                resolvePromise(0)
            }
        })
        child.on('exit', (code) => {
            if (!resolved) {
                resolved = true
                clearTimeout(timeoutId)
                if (code === 0) {
                    const parts = stdout.split('\t')
                    const size = parseInt(parts[0] ?? '0', 10)
                    resolvePromise(isNaN(size) ? 0 : size)
                } else {
                    resolvePromise(0)
                }
            }
        })
    })
}

async function getWorktreeBranch(worktreePath: string): Promise<string | null> {
    try {
        const branch = await runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath)
        return branch || null
    } catch {
        return null
    }
}

export type AttemptWithCard = {
    id: string
    boardId: string
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    worktreePath: string | null
    branchName: string
    baseBranch: string
    status: string
    agent: string
    createdAt: Date | number
    updatedAt: Date | number
}

export type WorktreeServiceDeps = {
    getProject: (projectId: string) => Promise<{id: string; name: string; repositoryPath: string} | null>
    listAttemptsWithCards: (boardId: string) => Promise<AttemptWithCard[]>
    getColumnTitle: (cardId: string) => Promise<string | null>
    removeWorktreeFromRepo: (repoPath: string, worktreePath: string) => Promise<void>
}

function toIso(d: Date | number | null | undefined): string | null {
    if (!d) return null
    const date = typeof d === 'number' ? new Date(d) : d
    return date.toISOString()
}

function determineWorktreeStatus(
    attemptStatus: string,
    columnTitle: string | null,
    existsOnDisk: boolean,
): WorktreeStatus {
    if (!existsOnDisk) return 'stale'
    if (attemptStatus === 'running') return 'locked'
    // All worktrees that exist on disk and aren't running are 'active'
    // (regardless of column - they're available for use/cleanup)
    return 'active'
}

export async function listWorktreesForProject(
    projectId: string,
    deps: WorktreeServiceDeps,
): Promise<WorktreesListResponse> {
    const project = await deps.getProject(projectId)
    if (!project) {
        throw new Error('Project not found')
    }

    const worktreesRoot = getProjectWorktreeFolder(project.name)
    const attempts = await deps.listAttemptsWithCards(projectId)

    const uniqueCardIds = [...new Set(attempts.map((a) => a.cardId))]
    const columnTitlesMap = new Map<string, string | null>()
    
    const columnTitlePromises = uniqueCardIds.map(async (cardId) => {
        const title = await deps.getColumnTitle(cardId)
        return {cardId, title}
    })
    const columnTitles = await Promise.all(columnTitlePromises)
    for (const {cardId, title} of columnTitles) {
        columnTitlesMap.set(cardId, title)
    }

    const trackedPaths = new Set<string>()
    const tracked: TrackedWorktree[] = []
    const stale: StaleWorktree[] = []

    for (const attempt of attempts) {
        if (!attempt.worktreePath) continue

        trackedPaths.add(attempt.worktreePath)
        const existsOnDisk = existsSync(attempt.worktreePath)
        const columnTitle = columnTitlesMap.get(attempt.cardId) ?? null

        if (!existsOnDisk) {
            stale.push({
                id: attempt.id,
                projectId: attempt.boardId,
                cardId: attempt.cardId,
                cardTitle: attempt.cardTitle,
                path: attempt.worktreePath,
                branchName: attempt.branchName,
                createdAt: toIso(attempt.createdAt) ?? new Date().toISOString(),
            })
        } else {
            let diskSizeBytes: number | null = null
            let lastModified: string | null = null
            try {
                const statInfo = await stat(attempt.worktreePath)
                lastModified = statInfo.mtime.toISOString()
                diskSizeBytes = await getDirectorySize(attempt.worktreePath)
            } catch (err) {
                log.debug('worktrees:list', 'Failed to get disk stats', {path: attempt.worktreePath, err})
            }

            const status = determineWorktreeStatus(attempt.status, columnTitle, existsOnDisk)

            tracked.push({
                id: attempt.id,
                projectId: attempt.boardId,
                cardId: attempt.cardId,
                cardTitle: attempt.cardTitle,
                ticketKey: attempt.ticketKey,
                path: attempt.worktreePath,
                branchName: attempt.branchName,
                baseBranch: attempt.baseBranch,
                status,
                attemptStatus: attempt.status,
                agent: attempt.agent,
                existsOnDisk: true,
                diskSizeBytes,
                lastModified,
                createdAt: toIso(attempt.createdAt) ?? new Date().toISOString(),
                updatedAt: toIso(attempt.updatedAt) ?? new Date().toISOString(),
            })
        }
    }

    const orphaned = await findOrphanedWorktrees(worktreesRoot, trackedPaths)

    const summary = computeSummary(tracked, orphaned, stale)

    return {
        projectId,
        projectName: project.name,
        worktreesRoot,
        summary,
        tracked,
        orphaned,
        stale,
    }
}

async function findOrphanedWorktrees(
    worktreesRoot: string,
    trackedPaths: Set<string>,
): Promise<OrphanedWorktree[]> {
    const orphaned: OrphanedWorktree[] = []

    if (!existsSync(worktreesRoot)) {
        return orphaned
    }

    try {
        const entries = await readdir(worktreesRoot, {withFileTypes: true})

        for (const entry of entries) {
            if (!entry.isDirectory()) continue

            const fullPath = join(worktreesRoot, entry.name)

            if (trackedPaths.has(fullPath)) continue

            // Git worktrees have a .git file (not a directory) that points to the main repo's worktree metadata
            // Regular repos have a .git directory, worktrees have a .git file - existsSync returns true for both
            const gitFilePath = join(fullPath, '.git')
            const isGitWorktree = existsSync(gitFilePath)
            if (!isGitWorktree) continue

            try {
                const statInfo = await stat(fullPath)
                const diskSizeBytes = await getDirectorySize(fullPath)
                const branchName = await getWorktreeBranch(fullPath)

                orphaned.push({
                    path: fullPath,
                    name: entry.name,
                    diskSizeBytes,
                    lastModified: statInfo.mtime.toISOString(),
                    branchName,
                })
            } catch (err) {
                log.warn('worktrees:orphan-scan', 'Failed to stat directory', {path: fullPath, err})
            }
        }
    } catch (err) {
        log.warn('worktrees:orphan-scan', 'Failed to scan worktrees root', {path: worktreesRoot, err})
    }

    return orphaned
}

function computeSummary(
    tracked: TrackedWorktree[],
    orphaned: OrphanedWorktree[],
    stale: StaleWorktree[],
): WorktreesSummary {
    const lockedWorktreesCount = tracked.filter((w) => w.status === 'locked').length
    const totalDiskUsage =
        tracked.reduce((sum, w) => sum + (w.diskSizeBytes ?? 0), 0) +
        orphaned.reduce((sum, w) => sum + w.diskSizeBytes, 0)

    return {
        tracked: tracked.length,
        locked: lockedWorktreesCount,
        orphaned: orphaned.length,
        stale: stale.length,
        totalDiskUsage,
    }
}

export async function syncWorktrees(
    projectId: string,
    deps: WorktreeServiceDeps,
): Promise<WorktreesSyncResponse> {
    const result = await listWorktreesForProject(projectId, deps)

    return {
        syncedAt: new Date().toISOString(),
        summary: result.summary,
        newOrphaned: result.orphaned.length,
        newStale: result.stale.length,
    }
}

export async function checkDeleteConstraints(
    attemptId: string,
    attemptStatus: string,
    cardId: string,
    deps: Pick<WorktreeServiceDeps, 'getColumnTitle'>,
): Promise<WorktreeDeleteConstraint | null> {
    const columnTitle = await deps.getColumnTitle(cardId)
    const col = (columnTitle || '').trim().toLowerCase()

    const isRunning = attemptStatus === 'running'
    const cardActive = col !== 'done'

    if (isRunning || cardActive) {
        const reasons: string[] = []
        if (isRunning) reasons.push('attempt is currently running')
        if (cardActive) reasons.push('card is not in Done column')

        return {
            activeAttempts: isRunning ? 1 : 0,
            cardActive,
            reason: `Cannot delete: ${reasons.join(', ')}. Move card to Done first or force delete.`,
        }
    }

    return null
}

export async function deleteTrackedWorktree(
    projectId: string,
    worktreePath: string,
    branchName: string,
    deps: Pick<WorktreeServiceDeps, 'removeWorktreeFromRepo' | 'getProject'>,
    options?: {deleteBranch?: boolean; deleteRemoteBranch?: boolean},
): Promise<{success: boolean; message: string}> {
    try {
        const project = await deps.getProject(projectId)
        if (!project) {
            return {success: false, message: 'Project not found'}
        }

        await deps.removeWorktreeFromRepo(project.repositoryPath, worktreePath)

        const branchResults: string[] = []

        if (options?.deleteBranch) {
            try {
                await git.deleteBranch(projectId, branchName)
                log.info('worktrees:delete', 'Local branch deleted', {branch: branchName})
            } catch (err) {
                branchResults.push('Failed to delete local branch')
                log.warn('worktrees:delete', 'Failed to delete local branch', {branch: branchName, err})
            }
        }

        if (options?.deleteRemoteBranch) {
            try {
                await git.deleteRemoteBranch(projectId, branchName)
                log.info('worktrees:delete', 'Remote branch deleted', {branch: branchName})
            } catch (err) {
                branchResults.push('Failed to delete remote branch')
                log.warn('worktrees:delete', 'Failed to delete remote branch', {branch: branchName, err})
            }
        }

        let message = 'Worktree removed successfully'
        if (branchResults.length > 0) {
            message += `. Note: ${branchResults.join(', ')}`
        }

        return {success: true, message}
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove worktree'
        log.error('worktrees:delete', 'Failed to delete worktree', {path: worktreePath, err})
        return {success: false, message}
    }
}

export async function deleteOrphanedWorktree(
    worktreePath: string,
    repoPath: string | null,
    projectName: string,
): Promise<{success: boolean; message: string}> {
    try {
        // Resolve symlinks to prevent TOCTOU attacks
        const realPath = await realpath(worktreePath).catch(() => null)
        
        if (!realPath) {
            return {success: true, message: 'Directory already removed'}
        }
        const expectedRoot = getProjectWorktreeFolder(projectName)
        const realRoot = await realpath(expectedRoot).catch(() => expectedRoot)

        if (!realPath.startsWith(realRoot)) {
            return {success: false, message: 'Invalid worktree path'}
        }

        if (repoPath) {
            try {
                await git.removeWorktreeAtPath(repoPath, realPath)
                return {success: true, message: 'Orphaned worktree removed via git'}
            } catch (gitErr) {
                log.warn('worktrees:delete-orphaned', 'Git worktree remove failed, falling back to rm', {
                    path: realPath,
                    err: gitErr,
                })
            }
        }

        // Attempt deletion - rm will fail naturally if path is invalid or lacks permissions
        await rm(realPath, {recursive: true, force: false})
        return {success: true, message: 'Orphaned directory removed'}
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove orphaned worktree'
        const errorDetails = err instanceof Error 
            ? {message: err.message, code: (err as any).code, errno: (err as any).errno}
            : {error: String(err)}
        log.error('worktrees:delete-orphaned', 'Failed to delete orphaned worktree', {
            path: worktreePath,
            projectName,
            repoPath,
            ...errorDetails,
            err
        })
        return {success: false, message}
    }
}
