import {readdir, stat, rm} from 'fs/promises'
import {join, basename} from 'path'
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
import {getProjectWorktreeFolder} from '../fs/paths'
import {log} from '../log'
import {git} from 'core'

function runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, {cwd})
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (d) => (stdout += d))
        child.stderr?.on('data', (d) => (stderr += d))
        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) resolve(stdout.trim())
            else reject(new Error(stderr || `git ${args.join(' ')} exited ${code}`))
        })
    })
}

async function getDirectorySize(dirPath: string): Promise<number> {
    return new Promise((resolve) => {
        const child = spawn('du', ['-sb', dirPath])
        let stdout = ''
        child.stdout?.on('data', (d) => (stdout += d))
        child.on('error', () => resolve(0))
        child.on('exit', (code) => {
            if (code === 0) {
                const parts = stdout.split('\t')
                const size = parseInt(parts[0] ?? '0', 10)
                resolve(isNaN(size) ? 0 : size)
            } else {
                resolve(0)
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
    const col = (columnTitle || '').trim().toLowerCase()
    if (col === 'done') return 'active'
    if (attemptStatus === 'running') return 'locked'
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

    const trackedPaths = new Set<string>()
    const tracked: TrackedWorktree[] = []
    const stale: StaleWorktree[] = []

    for (const attempt of attempts) {
        if (!attempt.worktreePath) continue

        trackedPaths.add(attempt.worktreePath)
        const existsOnDisk = existsSync(attempt.worktreePath)
        const columnTitle = await deps.getColumnTitle(attempt.cardId)

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
            } catch {}

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

            const isGitWorktree = existsSync(join(fullPath, '.git'))
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
    const activeCount = tracked.filter((w) => w.status === 'active' || w.status === 'locked').length
    const totalDiskUsage =
        tracked.reduce((sum, w) => sum + (w.diskSizeBytes ?? 0), 0) +
        orphaned.reduce((sum, w) => sum + w.diskSizeBytes, 0)

    return {
        tracked: tracked.length,
        active: activeCount,
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
    if (!existsSync(worktreePath)) {
        return {success: true, message: 'Worktree already removed from disk'}
    }

    try {
        const project = await deps.getProject(projectId)
        if (!project) {
            return {success: false, message: 'Project not found'}
        }

        await deps.removeWorktreeFromRepo(project.repositoryPath, worktreePath)

        if (options?.deleteBranch) {
            try {
                await git.deleteBranch(projectId, branchName)
                log.info('worktrees:delete', 'Local branch deleted', {branch: branchName})
            } catch (err) {
                log.warn('worktrees:delete', 'Failed to delete local branch', {branch: branchName, err})
            }
        }

        if (options?.deleteRemoteBranch) {
            try {
                await git.deleteRemoteBranch(projectId, branchName)
                log.info('worktrees:delete', 'Remote branch deleted', {branch: branchName})
            } catch (err) {
                log.warn('worktrees:delete', 'Failed to delete remote branch', {branch: branchName, err})
            }
        }

        return {success: true, message: 'Worktree removed successfully'}
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove worktree'
        log.error('worktrees:delete', 'Failed to delete worktree', {path: worktreePath, err})
        return {success: false, message}
    }
}

export async function deleteOrphanedWorktree(
    worktreePath: string,
    repoPath: string | null,
): Promise<{success: boolean; message: string}> {
    if (!existsSync(worktreePath)) {
        return {success: true, message: 'Directory already removed'}
    }

    try {
        if (repoPath) {
            try {
                await runGitCommand(['worktree', 'remove', '--force', worktreePath], repoPath)
                return {success: true, message: 'Orphaned worktree removed via git'}
            } catch {}
        }

        await rm(worktreePath, {recursive: true, force: true})
        return {success: true, message: 'Orphaned directory removed'}
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove orphaned worktree'
        log.error('worktrees:delete-orphaned', 'Failed to delete orphaned worktree', {path: worktreePath, err})
        return {success: false, message}
    }
}
