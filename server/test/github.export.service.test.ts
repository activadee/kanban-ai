import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('core', () => {
    return {
        githubRepo: {
            insertGithubIssueMapping: vi.fn(),
            getGithubConnection: vi.fn(),
        },
        getGitOriginUrl: vi.fn(),
        parseGithubOwnerRepo: vi.fn(),
    }
})

vi.mock('../src/github/api', () => ({
    createRepoIssue: vi.fn(),
}))

describe('GitHub issue export service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates a GitHub issue and stores mapping as exported', async () => {
        const core = await import('core' as any)
        const {createRepoIssue} = await import('../src/github/api')
        const {createGithubIssueForCard} = await import('../src/github/export.service')

        core.getGitOriginUrl.mockResolvedValueOnce('https://github.com/acme/repo')
        core.parseGithubOwnerRepo.mockReturnValueOnce({owner: 'acme', repo: 'repo'})
        ;(createRepoIssue as any).mockResolvedValueOnce({
            id: 123,
            number: 7,
            title: '[PRJ-1] Hello',
            html_url: 'https://github.com/acme/repo/issues/7',
            state: 'open',
        })

        const res = await createGithubIssueForCard({
            boardId: 'b1',
            cardId: 'c1',
            repositoryPath: '/repo',
            title: 'Hello',
            description: 'Desc',
            ticketKey: 'PRJ-1',
        })

        expect(createRepoIssue).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: 'acme',
                repo: 'repo',
                title: '[PRJ-1] Hello',
            }),
        )
        expect(core.githubRepo.insertGithubIssueMapping).toHaveBeenCalledWith(
            expect.objectContaining({
                boardId: 'b1',
                cardId: 'c1',
                owner: 'acme',
                repo: 'repo',
                direction: 'exported',
                issueId: '123',
                issueNumber: 7,
                url: 'https://github.com/acme/repo/issues/7',
                state: 'open',
            }),
        )
        expect(res).toEqual({
            issueNumber: 7,
            url: 'https://github.com/acme/repo/issues/7',
        })
    })
})

