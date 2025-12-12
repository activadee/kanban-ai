import {describe, it, expect, vi, beforeEach} from 'vitest'

vi.mock('core', () => {
    return {
        projectsService: {
            list: vi.fn(),
            getSettings: vi.fn(),
        },
        githubRepo: {
            getGithubConnection: vi.fn(),
        },
        getGitOriginUrl: vi.fn(),
        parseGithubOwnerRepo: vi.fn(),
        projectSettingsSync: {
            isGithubIssueSyncEnabled: vi.fn(),
            isGithubIssueSyncDue: vi.fn(),
            tryStartGithubIssueSync: vi.fn(),
            completeGithubIssueSync: vi.fn(),
        },
    }
})

vi.mock('../src/github/import.service', () => ({
    importGithubIssues: vi.fn(),
}))

const createBus = () => {
    return {
        publish: vi.fn(),
        subscribe: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        listenerCount: vi.fn(),
    }
}

describe('github issue sync scheduler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('skips when no GitHub connection exists', async () => {
        const core = await import('core' as any)
        const {runGithubIssueSyncTick} = await import('../src/github/sync')

        core.githubRepo.getGithubConnection.mockResolvedValueOnce(null)

        const bus = createBus()
        await runGithubIssueSyncTick(bus as any)

        expect(core.projectsService.list).not.toHaveBeenCalled()
    })

    it('enqueues sync only for eligible projects and calls importGithubIssues', async () => {
        const core = await import('core' as any)
        const {importGithubIssues} = await import('../src/github/import.service')
        const {runGithubIssueSyncTick} = await import('../src/github/sync')

        core.githubRepo.getGithubConnection.mockResolvedValueOnce({id: 'default'})
        core.projectsService.list.mockResolvedValueOnce([
            {id: 'p1', boardId: 'p1', name: 'Project 1', repositoryPath: '/repo1', repositoryUrl: null, repositorySlug: 'repo1', status: 'Active', createdAt: new Date().toISOString()},
        ])
        core.projectsService.getSettings.mockResolvedValueOnce({
            projectId: 'p1',
            boardId: 'p1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
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
            githubIssueAutoCreateEnabled: false,
            lastGithubIssueSyncAt: null,
            lastGithubIssueSyncStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        core.projectSettingsSync.isGithubIssueSyncEnabled.mockReturnValue(true)
        core.projectSettingsSync.isGithubIssueSyncDue.mockReturnValue(true)
        core.projectSettingsSync.tryStartGithubIssueSync.mockResolvedValue(true)
        core.getGitOriginUrl.mockResolvedValueOnce('https://github.com/owner/repo')
        core.parseGithubOwnerRepo.mockReturnValue({owner: 'owner', repo: 'repo'})
        ;(importGithubIssues as any).mockResolvedValue({imported: 1, updated: 0, skipped: 0})

        const bus = createBus()
        await runGithubIssueSyncTick(bus as any)

        expect(importGithubIssues).toHaveBeenCalledWith(
            expect.objectContaining({
                boardId: 'p1',
                owner: 'owner',
                repo: 'repo',
                state: 'open',
            }),
            expect.objectContaining({
                bus,
                logContext: expect.objectContaining({
                    projectId: 'p1',
                    boardId: 'p1',
                    owner: 'owner',
                    repo: 'repo',
                    state: 'open',
                    trigger: 'scheduled',
                }),
            }),
        )
    })
})
