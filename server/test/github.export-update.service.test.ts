import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('core', () => {
    return {
        githubRepo: {
            findGithubIssueMappingByCardId: vi.fn(),
            updateGithubIssueMapping: vi.fn(),
            getGithubConnection: vi.fn(),
        },
    }
})

vi.mock('../src/github/api', () => ({
    updateRepoIssue: vi.fn(),
}))

describe('GitHub issue export update service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('updates exported issue and mapping', async () => {
        const core = await import('core' as any)
        const {updateRepoIssue} = await import('../src/github/api')
        const {updateGithubIssueForCard} = await import('../src/github/export-update.service')

        core.githubRepo.findGithubIssueMappingByCardId.mockResolvedValueOnce({
            id: 'm1',
            cardId: 'c1',
            owner: 'acme',
            repo: 'repo',
            issueNumber: 9,
            direction: 'exported',
        })
        ;(updateRepoIssue as any).mockResolvedValueOnce({
            id: 1,
            number: 9,
            title: 'New title',
            html_url: 'u',
            state: 'open',
        })

        await updateGithubIssueForCard('c1', {title: 'New title', description: 'Body'})

        expect(updateRepoIssue).toHaveBeenCalledWith(
            expect.objectContaining({owner: 'acme', repo: 'repo', issueNumber: 9, title: 'New title', body: 'Body'}),
        )
        expect(core.githubRepo.updateGithubIssueMapping).toHaveBeenCalledWith(
            'm1',
            expect.objectContaining({titleSnapshot: 'New title', state: 'open'}),
        )
    })

    it('skips non-exported mappings', async () => {
        const core = await import('core' as any)
        const {updateRepoIssue} = await import('../src/github/api')
        const {updateGithubIssueForCard} = await import('../src/github/export-update.service')

        core.githubRepo.findGithubIssueMappingByCardId.mockResolvedValueOnce({
            id: 'm1',
            cardId: 'c1',
            owner: 'acme',
            repo: 'repo',
            issueNumber: 9,
            direction: 'imported',
        })

        await updateGithubIssueForCard('c1', {title: 'x'})
        expect(updateRepoIssue).not.toHaveBeenCalled()
    })
})

