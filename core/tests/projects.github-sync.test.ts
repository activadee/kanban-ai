import {describe, it, expect} from 'vitest'

describe('projects/settings/github-sync', () => {
    it('normalizes interval and detects due syncs', async () => {
        const sync = await import('../src/projects/settings/github-sync')

        expect(sync.normalizeGithubIssueSyncInterval(undefined)).toBe(15)
        expect(sync.normalizeGithubIssueSyncInterval(1)).toBe(sync.MIN_GITHUB_SYNC_INTERVAL_MINUTES)
        expect(sync.normalizeGithubIssueSyncInterval(5000)).toBe(sync.MAX_GITHUB_SYNC_INTERVAL_MINUTES)

        const now = new Date('2025-01-01T12:00:00Z')

        const settings: import('shared').ProjectSettings = {
            projectId: 'p1',
            boardId: 'p1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            allowScriptsToFail: false,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: false,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
            defaultAgent: null,
            defaultProfileId: null,
            inlineAgent: null,
            inlineProfileId: null,
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            githubIssueSyncEnabled: true,
            githubIssueSyncState: 'open',
            githubIssueSyncIntervalMinutes: 15,
            lastGithubIssueSyncAt: null,
            lastGithubIssueSyncStatus: 'idle',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        }

        expect(sync.isGithubIssueSyncEnabled(settings)).toBe(true)
        expect(sync.isGithubIssueSyncDue(settings, now)).toBe(true)

        const recent = {
            ...settings,
            lastGithubIssueSyncAt: new Date(now.getTime() - 5 * 60 * 1000 + 1_000).toISOString(),
        }
        expect(sync.isGithubIssueSyncDue(recent, now)).toBe(false)

        const old = {
            ...settings,
            lastGithubIssueSyncAt: new Date(now.getTime() - 16 * 60 * 1000).toISOString(),
        }
        expect(sync.isGithubIssueSyncDue(old, now)).toBe(true)
    })
})
