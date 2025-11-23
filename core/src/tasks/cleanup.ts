import simpleGit from 'simple-git'
import {getAttemptForCard, updateAttempt} from '../attempts/repo'
import {getRepositoryPath} from '../projects/repo'
import {removeWorktree} from '../ports/worktree'

export type CleanupResult = {
    worktreeRemoved: boolean
    branchRemoved: boolean
    skipped?: 'no_attempt' | 'no_repo'
}

/**
 * Remove the git worktree and local branch associated with a card's attempt.
 * Intended to run when a ticket is moved to the Done column.
 */
export async function cleanupCardWorkspace(boardId: string, cardId: string): Promise<CleanupResult> {
    const attempt = await getAttemptForCard(boardId, cardId)
    if (!attempt) return {worktreeRemoved: false, branchRemoved: false, skipped: 'no_attempt'}

    const repoPath = await getRepositoryPath(boardId)
    if (!repoPath) return {worktreeRemoved: false, branchRemoved: false, skipped: 'no_repo'}

    let worktreeRemoved = false
    let branchRemoved = false

    // Best-effort worktree removal; provider already emits worktree.removed events.
    if (attempt.worktreePath) {
        try {
            await removeWorktree(repoPath, attempt.worktreePath, {projectId: boardId, attemptId: attempt.id})
            worktreeRemoved = true
        } catch (error) {
            console.error('[tasks:cleanup] failed to remove worktree', error)
        }
    }

    // Delete the attempt branch as long as it is not the base branch.
    const branchName = attempt.branchName?.trim()
    const baseBranch = attempt.baseBranch?.trim()
    if (branchName && branchName !== baseBranch) {
        try {
            const git = simpleGit({baseDir: repoPath})
            const branches = await git.branchLocal()
            const exists = branches.all?.includes(branchName)
            if (exists) {
                if (branches.current === branchName) {
                    const fallback = baseBranch && baseBranch !== branchName ? baseBranch : 'main'
                    try {
                        await git.checkout(fallback)
                    } catch {
                        // If checkout fails, continue with delete; git will throw a clearer error if blocked.
                    }
                }
                await git.deleteLocalBranch(branchName, true)
                branchRemoved = true
            }
        } catch (error) {
            console.error('[tasks:cleanup] failed to delete branch for done card', error)
        }
    }

    try {
        await updateAttempt(attempt.id, {worktreePath: null, updatedAt: new Date()})
    } catch (error) {
        console.error('[tasks:cleanup] failed to update attempt after cleanup', error)
    }

    return {worktreeRemoved, branchRemoved}
}

