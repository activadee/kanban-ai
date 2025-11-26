import type {AppEventBus} from '../events/bus'
import {getWorktreesRoot, getProjectWorktreeFolder} from './paths'
import {rm} from 'fs/promises'
import {join} from 'path'
import {spawn} from 'child_process'
import {log} from '../log'

async function pruneGitWorktrees(repositoryPath?: string | null) {
    if (!repositoryPath) return
    await new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['worktree', 'prune'], {cwd: repositoryPath})
        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`git worktree prune exited with ${code}`))
        })
    })
}

export function registerFsListeners(bus: AppEventBus) {
    bus.subscribe('project.deleted', async ({projectId, projectName, repositoryPath}) => {
        try {
            const legacyPath = join(getWorktreesRoot(), projectId)
            await rm(legacyPath, {recursive: true, force: true})

            if (projectName) {
                const namedPath = getProjectWorktreeFolder(projectName)
                await rm(namedPath, {recursive: true, force: true})
            }

            // Also prune any stale Git worktree entries that pointed at the
            // removed folders so `git worktree list` stays clean.
            await pruneGitWorktrees(repositoryPath)
        } catch (error) {
            log.error({err: error}, '[fs] failed to cleanup worktrees on project.deleted')
        }
    })
}
