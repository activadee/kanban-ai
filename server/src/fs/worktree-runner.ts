import {mkdir} from 'fs/promises'
import {resolve} from 'path'
import {spawn} from 'child_process'
import type {AppEventBus} from '../events/bus'
import {log} from '../log'

let worktreeEvents: AppEventBus | null = null

type WorktreeEventMeta = {
    projectId?: string
    attemptId?: string
}

export function bindWorktreeEventBus(bus: AppEventBus) {
    worktreeEvents = bus
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(cmd, args, {cwd})
        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) resolvePromise()
            else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))
        })
    })
}

function publishWorktreeCreated(meta: WorktreeEventMeta | undefined, path: string, branchName: string, baseBranch: string) {
    if (!worktreeEvents) return
    if (!meta?.projectId || !meta.attemptId) return
    worktreeEvents.publish('worktree.created', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        path,
        branchName,
        baseBranch,
    })
}

function publishWorktreeRemoved(meta: WorktreeEventMeta | undefined, path: string) {
    if (!worktreeEvents) return
    if (!meta?.projectId || !meta.attemptId) return
    worktreeEvents.publish('worktree.removed', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        path,
    })
}

export async function createWorktree(repoPath: string, baseBranch: string, branchName: string, outDir: string, meta?: WorktreeEventMeta) {
    const worktreesRoot = resolve(outDir)
    await mkdir(worktreesRoot, {recursive: true})
    try {
        await run('git', ['fetch', 'origin', '--prune'], repoPath)
        // Mirror the remote base branch into a local ref so the worktree can track it without the remote upstream default.
        await run('git', ['fetch', 'origin', `${baseBranch}:${baseBranch}`], repoPath)
    } catch {
    }
    await run('git', ['worktree', 'add', '-B', branchName, worktreesRoot, baseBranch], repoPath)
    publishWorktreeCreated(meta, worktreesRoot, branchName, baseBranch)
    return worktreesRoot
}

export async function removeWorktree(repoPath: string, worktreePath: string, meta?: WorktreeEventMeta) {
    try {
        await run('git', ['worktree', 'remove', '--force', worktreePath], repoPath)
        publishWorktreeRemoved(meta, worktreePath)
    } catch (err) {
        log.warn('worktree:remove', 'failed', {err})
    }
}
