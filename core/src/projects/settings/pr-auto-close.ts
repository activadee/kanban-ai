import type {ProjectSettings} from 'shared'
import {getProjectSettingsRepo} from '../../repos/provider'
import type {GithubPrAutoCloseStatus} from '../../repos/interfaces'
import {
    MIN_GITHUB_SYNC_INTERVAL_MINUTES,
    normalizeGithubIssueSyncInterval,
} from './github-sync'

export type {GithubPrAutoCloseStatus}

const STALE_RUNNING_THRESHOLD_MINUTES = 60

export function isGithubPrAutoCloseEnabled(
    settings: ProjectSettings,
): boolean {
    if (!settings.autoCloseTicketOnPRMerge) return false
    const interval = normalizeGithubIssueSyncInterval(
        settings.githubIssueSyncIntervalMinutes,
    )
    return interval >= MIN_GITHUB_SYNC_INTERVAL_MINUTES
}

export function isGithubIssueAutoCloseEnabled(
    settings: ProjectSettings,
): boolean {
    if (!settings.autoCloseTicketOnIssueClose) return false
    const interval = normalizeGithubIssueSyncInterval(
        settings.githubIssueSyncIntervalMinutes,
    )
    return interval >= MIN_GITHUB_SYNC_INTERVAL_MINUTES
}

export function isGithubPrAutoCloseDue(
    settings: ProjectSettings,
    now: Date = new Date(),
): boolean {
    if (!isGithubPrAutoCloseEnabled(settings)) return false
    const intervalMinutes = normalizeGithubIssueSyncInterval(
        settings.githubIssueSyncIntervalMinutes,
    )
    const lastAtStr = settings.lastGithubPrAutoCloseAt
    if (!lastAtStr) return true
    const lastAt = new Date(lastAtStr)
    if (Number.isNaN(lastAt.getTime())) return true
    const elapsedMs = now.getTime() - lastAt.getTime()
    return elapsedMs >= intervalMinutes * 60 * 1000
}

export async function tryStartGithubPrAutoClose(
    projectId: string,
    now: Date = new Date(),
): Promise<boolean> {
    const staleCutoff = new Date(
        now.getTime() - STALE_RUNNING_THRESHOLD_MINUTES * 60 * 1000,
    )
    return getProjectSettingsRepo().tryStartGithubPrAutoClose(projectId, now, staleCutoff)
}

export async function completeGithubPrAutoClose(
    projectId: string,
    status: Exclude<GithubPrAutoCloseStatus, 'running'>,
    now: Date = new Date(),
): Promise<void> {
    return getProjectSettingsRepo().completeGithubPrAutoClose(projectId, status, now)
}
