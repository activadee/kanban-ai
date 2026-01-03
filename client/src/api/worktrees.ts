import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'
import type {
    WorktreesListResponse,
    WorktreesSyncResponse,
    WorktreeDeleteResponse,
    WorktreeDeleteRequest,
    OrphanedWorktreeDeleteRequest,
    StaleWorktreeDeleteRequest,
} from 'shared'

export async function getWorktrees(projectId: string): Promise<WorktreesListResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/worktrees`)
    return parseApiResponse<WorktreesListResponse>(res)
}

export async function syncWorktrees(projectId: string): Promise<WorktreesSyncResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/worktrees/sync`, {
        method: 'POST',
    })
    return parseApiResponse<WorktreesSyncResponse>(res)
}

export async function deleteWorktree(
    projectId: string,
    worktreeId: string,
    options?: WorktreeDeleteRequest,
): Promise<WorktreeDeleteResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/worktrees/${worktreeId}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(options ?? {}),
    })
    return parseApiResponse<WorktreeDeleteResponse>(res)
}

export async function deleteOrphanedWorktree(
    projectId: string,
    encodedPath: string,
    options: OrphanedWorktreeDeleteRequest,
): Promise<WorktreeDeleteResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/worktrees/orphaned/${encodedPath}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(options),
    })
    return parseApiResponse<WorktreeDeleteResponse>(res)
}

export async function deleteStaleWorktree(
    projectId: string,
    worktreeId: string,
    options: StaleWorktreeDeleteRequest,
): Promise<WorktreeDeleteResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/worktrees/stale/${worktreeId}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(options),
    })
    return parseApiResponse<WorktreeDeleteResponse>(res)
}
