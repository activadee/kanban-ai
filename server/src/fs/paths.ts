import {join} from 'path'
import os from 'os'

function sanitizeSegment(input: string, max = 64): string {
    const stripped = input
        .normalize('NFKD')
        .replace(/[^\w\-\s.]+/g, '') // remove non-word except dash/space/dot
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .toLowerCase()
    return stripped.slice(0, max) || 'untitled'
}

const WORKTREE_ROOT = join(os.homedir(), '.kanbanAI', 'worktrees')

export function getWorktreesRoot(): string {
    return WORKTREE_ROOT
}

// Legacy helper (id-based). Preserve for backwards-compat in case an attempt row already stored it.
export function getWorktreePath(boardId: string, attemptId: string): string {
    return join(getWorktreesRoot(), boardId, attemptId)
}

export function getWorktreePathByNames(projectName: string, taskTitle: string): string {
    const project = sanitizeSegment(projectName, 64)
    const task = sanitizeSegment(taskTitle, 64)
    return join(getWorktreesRoot(), project, task)
}

export function getProjectWorktreeFolder(projectName: string): string {
    const project = sanitizeSegment(projectName, 64)
    return join(getWorktreesRoot(), project)
}
