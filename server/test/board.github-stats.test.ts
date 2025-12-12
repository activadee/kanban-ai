import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import {createBoardRouter} from '../src/projects/board.routes'

vi.mock('core', () => {
    return {
        githubRepo: {
            getGithubIssueStats: vi.fn(),
            getGithubConnection: vi.fn(),
        },
        projectsRepo: {},
        projectDeps: {},
        tasks: {},
        projectsService: {},
    }
})

const resolveBoard = async () => ({
    boardId: 'b1',
    project: {
        id: 'p1',
        boardId: 'b1',
        name: 'Project',
        status: 'Active',
        createdAt: new Date().toISOString(),
        repositoryPath: '/repo',
        repositoryUrl: null,
        repositorySlug: 'repo',
    },
})

const createApp = () => {
    const app = new Hono()
    app.route('/boards/:boardId', createBoardRouter(resolveBoard as any))
    return app
}

describe('GET /boards/:boardId/github/issues/stats', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns stats from core', async () => {
        const app = createApp()
        const core = await import('core' as any)
        core.githubRepo.getGithubIssueStats.mockResolvedValueOnce({imported: 1, exported: 2, total: 3})

        const res = await app.request('/boards/b1/github/issues/stats')
        expect(res.status).toBe(200)
        expect(core.githubRepo.getGithubIssueStats).toHaveBeenCalledWith('b1')
        expect(await res.json()).toEqual({imported: 1, exported: 2, total: 3})
    })
})

