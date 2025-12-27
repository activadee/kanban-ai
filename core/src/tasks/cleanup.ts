import simpleGit from 'simple-git'
import {getAttemptForCardByKind, updateAttempt} from '../attempts/repo'
import {getRepositoryPath} from '../projects/repo'
import {removeWorktree} from '../ports/worktree'
import type {AttemptStatus} from 'shared'

export type CleanupResult = {
    worktreeRemoved: boolean
    branchRemoved: boolean
    skipped?: 'no_attempt' | 'no_repo' | 'in_progress'
}

type AttemptForCleanup = {
    id: string
    status: string
    branchName: string
    baseBranch: string
    worktreePath: string | null
}

async function cleanupAttemptWorkspace(
    repoPath: string,
    boardId: string,
    cardId: string,
    attempt: AttemptForCleanup,
): Promise<{worktreeRemoved: boolean; branchRemoved: boolean}> {
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
    if (branchName && baseBranch && branchName !== baseBranch) {
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

    if (worktreeRemoved) {
        try {
            await updateAttempt(attempt.id, {worktreePath: null, updatedAt: new Date()})
            console.info('[tasks:cleanup] cleared worktreePath for attempt', {
                attemptId: attempt.id,
                boardId,
                cardId,
            })
        } catch (error) {
            console.error('[tasks:cleanup] failed to update attempt after cleanup', error)
        }
    }

    return {worktreeRemoved, branchRemoved}
}

/**
 * Remove the git worktree and local branch associated with a card's attempt.
 * Intended to run when a ticket is moved to the Done column.
 */
export async function cleanupCardWorkspace(boardId: string, cardId: string): Promise<CleanupResult> {
    const implementationAttempt = await getAttemptForCardByKind(boardId, cardId, false)
    const planningAttempt = await getAttemptForCardByKind(boardId, cardId, true)

    const attempts = [implementationAttempt, planningAttempt].filter((item): item is NonNullable<typeof item> => Boolean(item))
    if (attempts.length === 0) return {worktreeRemoved: false, branchRemoved: false, skipped: 'no_attempt'}

    const inProgress = attempts.some((attempt) => {
        const status = attempt.status as AttemptStatus
        return status === 'queued' || status === 'running' || status === 'stopping'
    })

    if (inProgress) {
        return {worktreeRemoved: false, branchRemoved: false, skipped: 'in_progress'}
    }

    const repoPath = await getRepositoryPath(boardId)
    if (!repoPath) return {worktreeRemoved: false, branchRemoved: false, skipped: 'no_repo'}

    let worktreeRemoved = false
    let branchRemoved = false

    for (const attempt of attempts) {
        const res = await cleanupAttemptWorkspace(repoPath, boardId, cardId, {
            id: attempt.id,
            status: attempt.status,
            branchName: attempt.branchName,
            baseBranch: attempt.baseBranch,
            worktreePath: attempt.worktreePath,
        })
        worktreeRemoved = worktreeRemoved || res.worktreeRemoved
        branchRemoved = branchRemoved || res.branchRemoved
    }

    return {worktreeRemoved, branchRemoved}
}
