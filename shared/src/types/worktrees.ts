/**
 * Worktree status indicating the state of a worktree entry.
 */
export type WorktreeStatus = 'active' | 'orphaned' | 'stale' | 'locked'

/**
 * Represents a worktree tracked in the database with its associated attempt.
 */
export interface TrackedWorktree {
    /** Unique worktree identifier (attempt ID) */
    id: string
    /** Project/board ID this worktree belongs to */
    projectId: string
    /** Card/ticket ID this worktree is for */
    cardId: string
    /** Card title for display */
    cardTitle: string | null
    /** Ticket key (e.g., "PROJ-123") */
    ticketKey: string | null
    /** Absolute path to the worktree directory */
    path: string
    /** Git branch name for this worktree */
    branchName: string
    /** Base branch the worktree was created from */
    baseBranch: string
    /** Current status of the worktree */
    status: WorktreeStatus
    /** Status of the associated attempt */
    attemptStatus: string
    /** Agent used for the attempt */
    agent: string
    /** Whether the worktree exists on disk */
    existsOnDisk: boolean
    /** Disk size in bytes (if available) */
    diskSizeBytes: number | null
    /** Last modified time on disk (ISO 8601) */
    lastModified: string | null
    /** When the worktree/attempt was created (ISO 8601) */
    createdAt: string
    /** When the worktree/attempt was last updated (ISO 8601) */
    updatedAt: string
}

/**
 * Represents a worktree found on disk but not tracked in the database.
 */
export interface OrphanedWorktree {
    /** Absolute path to the worktree directory */
    path: string
    /** Directory name */
    name: string
    /** Disk size in bytes */
    diskSizeBytes: number
    /** Last modified time (ISO 8601) */
    lastModified: string
    /** Git branch name (if detectable) */
    branchName: string | null
}

/**
 * Represents a database entry with a missing disk path.
 */
export interface StaleWorktree {
    /** Attempt ID */
    id: string
    /** Project/board ID */
    projectId: string
    /** Card ID */
    cardId: string
    /** Card title */
    cardTitle: string | null
    /** Expected path that doesn't exist */
    path: string
    /** Branch name */
    branchName: string
    /** When the entry was created (ISO 8601) */
    createdAt: string
}

/**
 * Summary of worktrees for a project.
 */
export interface WorktreesSummary {
    /** Total count of tracked worktrees */
    tracked: number
    /** Count of worktrees with locked attempts */
    locked: number
    /** Count of orphaned worktrees (disk only) */
    orphaned: number
    /** Count of stale entries (DB only, missing on disk) */
    stale: number
    /** Total disk usage in bytes */
    totalDiskUsage: number
}

/**
 * Response from GET /projects/:projectId/worktrees
 */
export interface WorktreesListResponse {
    /** Project ID */
    projectId: string
    /** Project name */
    projectName: string
    /** Worktrees root directory for this project */
    worktreesRoot: string
    /** Summary statistics */
    summary: WorktreesSummary
    /** Tracked worktrees (from database) */
    tracked: TrackedWorktree[]
    /** Orphaned worktrees (disk only) */
    orphaned: OrphanedWorktree[]
    /** Stale entries (DB only) */
    stale: StaleWorktree[]
}

/**
 * Response from POST /projects/:projectId/worktrees/sync
 */
export interface WorktreesSyncResponse {
    /** When the sync was performed (ISO 8601) */
    syncedAt: string
    /** Updated summary after sync */
    summary: WorktreesSummary
    /** Number of new orphaned worktrees discovered */
    newOrphaned: number
    /** Number of new stale entries discovered */
    newStale: number
}

/**
 * Request body for DELETE /projects/:projectId/worktrees/:id
 */
export interface WorktreeDeleteRequest {
    /** Force delete even if attempt is active (requires confirmation) */
    force?: boolean
    /** Only delete from disk, keep database record */
    diskOnly?: boolean
    /** Also delete the local Git branch */
    deleteBranch?: boolean
    /** Also delete the remote Git branch */
    deleteRemoteBranch?: boolean
}

/**
 * Response from DELETE /projects/:projectId/worktrees/:id
 */
export interface WorktreeDeleteResponse {
    /** Whether the deletion was successful */
    success: boolean
    /** Message describing the result */
    message: string
    /** Path that was deleted (if applicable) */
    deletedPath?: string
}

/**
 * Constraint error when attempting to delete an active worktree.
 */
export interface WorktreeDeleteConstraint {
    /** Number of active attempts using this worktree */
    activeAttempts: number
    /** Whether the card is in an active column (not Done) */
    cardActive: boolean
    /** Reason deletion is blocked */
    reason: string
}

/**
 * Request body for DELETE /projects/:projectId/worktrees/orphaned/:path
 * (path is URL-encoded in the route)
 */
export interface OrphanedWorktreeDeleteRequest {
    /** Confirm deletion of orphaned worktree */
    confirm: boolean
}

/**
 * Request body for DELETE /projects/:projectId/worktrees/stale/:id
 */
export interface StaleWorktreeDeleteRequest {
    /** Confirm cleanup of stale database record */
    confirm: boolean
}
