import type {ProjectSettings} from 'shared'
import {getProjectSettingsRepo} from '../../repos/provider'
import type {GithubIssueSyncStatus} from '../../repos/interfaces'

export type {GithubIssueSyncStatus}

export const MIN_GITHUB_SYNC_INTERVAL_MINUTES = 5
export const MAX_GITHUB_SYNC_INTERVAL_MINUTES = 1440
export const DEFAULT_GITHUB_SYNC_INTERVAL_MINUTES = 15
const STALE_RUNNING_THRESHOLD_MINUTES = 60

export function normalizeGithubIssueSyncInterval(minutes: number | null | undefined): number {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
        return DEFAULT_GITHUB_SYNC_INTERVAL_MINUTES
    }
    const value = Math.floor(minutes)
    if (value < MIN_GITHUB_SYNC_INTERVAL_MINUTES) return MIN_GITHUB_SYNC_INTERVAL_MINUTES
    if (value > MAX_GITHUB_SYNC_INTERVAL_MINUTES) return MAX_GITHUB_SYNC_INTERVAL_MINUTES
    return value
}

export function isGithubIssueSyncEnabled(settings: ProjectSettings): boolean {
    if (!settings.githubIssueSyncEnabled) return false
    const interval = normalizeGithubIssueSyncInterval(settings.githubIssueSyncIntervalMinutes)
    return interval >= MIN_GITHUB_SYNC_INTERVAL_MINUTES
}

export function isGithubIssueSyncDue(settings: ProjectSettings, now: Date = new Date()): boolean {
    if (!isGithubIssueSyncEnabled(settings)) return false
    const intervalMinutes = normalizeGithubIssueSyncInterval(settings.githubIssueSyncIntervalMinutes)
    const lastAtStr = settings.lastGithubIssueSyncAt
    if (!lastAtStr) return true
    const lastAt = new Date(lastAtStr)
    if (Number.isNaN(lastAt.getTime())) return true
    const elapsedMs = now.getTime() - lastAt.getTime()
    return elapsedMs >= intervalMinutes * 60 * 1000
}

export async function tryStartGithubIssueSync(
    projectId: string,
    now: Date = new Date(),
): Promise<boolean> {
    const staleCutoff = new Date(now.getTime() - STALE_RUNNING_THRESHOLD_MINUTES * 60 * 1000)
    return getProjectSettingsRepo().tryStartGithubIssueSync(projectId, now, staleCutoff)
}

export async function completeGithubIssueSync(
    projectId: string,
    status: Exclude<GithubIssueSyncStatus, 'running'>,
    now: Date = new Date(),
): Promise<void> {
    return getProjectSettingsRepo().completeGithubIssueSync(projectId, status, now)
}
