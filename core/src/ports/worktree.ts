export type WorktreeMeta = { projectId?: string; attemptId?: string }

export interface WorktreeProvider {
    createWorktree(repoPath: string, baseBranch: string, branchName: string, outDir: string, meta?: WorktreeMeta): Promise<string>

    removeWorktree(repoPath: string, worktreePath: string, meta?: WorktreeMeta): Promise<void>

    getWorktreePath(projectId: string, attemptId: string): string

    getWorktreePathByNames(projectName: string, taskName: string): string
}

let provider: WorktreeProvider | null = null

export function setWorktreeProvider(p: WorktreeProvider) {
    provider = p
}

export async function createWorktree(repoPath: string, baseBranch: string, branchName: string, outDir: string, meta?: WorktreeMeta) {
    if (!provider) throw new Error('[core:worktree] provider not set')
    return provider.createWorktree(repoPath, baseBranch, branchName, outDir, meta)
}

export async function removeWorktree(repoPath: string, worktreePath: string, meta?: WorktreeMeta) {
    if (!provider) throw new Error('[core:worktree] provider not set')
    return provider.removeWorktree(repoPath, worktreePath, meta)
}

export function getWorktreePath(projectId: string, attemptId: string): string {
    if (!provider) throw new Error('[core:worktree] provider not set')
    return provider.getWorktreePath(projectId, attemptId)
}

export function getWorktreePathByNames(projectName: string, taskName: string): string {
    if (!provider) throw new Error('[core:worktree] provider not set')
    return provider.getWorktreePathByNames(projectName, taskName)
}

