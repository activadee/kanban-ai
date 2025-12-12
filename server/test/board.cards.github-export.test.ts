import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import {createBoardRouter} from '../src/projects/board.routes'

vi.mock('core', () => {
    return {
        projectsRepo: {
            getColumnById: vi.fn(),
            getCardById: vi.fn(),
            listCardsForColumns: vi.fn(),
        },
        projectDeps: {
            setDependencies: vi.fn(),
        },
        tasks: {
            createBoardCard: vi.fn(),
            updateBoardCard: vi.fn(),
            broadcastBoard: vi.fn(),
            getBoardState: vi.fn(),
        },
        projectsService: {
            getSettings: vi.fn(),
        },
        githubRepo: {
            getGithubConnection: vi.fn(),
            findGithubIssueMappingByCardId: vi.fn(),
            updateGithubIssueMapping: vi.fn(),
        },
    }
})

vi.mock('../src/github/export.service', () => ({
    createGithubIssueForCard: vi.fn(),
}))

vi.mock('../src/github/export-update.service', () => ({
    updateGithubIssueForCard: vi.fn(),
}))

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

describe('POST /boards/:boardId/cards with GitHub export', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates a GitHub issue when requested and enabled', async () => {
        const app = createApp()
        const core = await import('core' as any)
        const {createGithubIssueForCard} = await import('../src/github/export.service')

        core.projectsRepo.getColumnById.mockResolvedValueOnce({id: 'col-1', boardId: 'b1'})
        core.tasks.createBoardCard.mockResolvedValueOnce('card-1')
        core.projectsRepo.getCardById.mockResolvedValueOnce({id: 'card-1', ticketKey: 'PRJ-1'})
        core.projectDeps.setDependencies.mockResolvedValueOnce(undefined)
        core.tasks.broadcastBoard.mockResolvedValueOnce(undefined)
        core.tasks.getBoardState.mockResolvedValueOnce({columns: {}, columnOrder: [], cards: {}})
        core.projectsService.getSettings.mockResolvedValueOnce({githubIssueAutoCreateEnabled: true})

        const res = await app.request('/boards/b1/cards', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                columnId: 'col-1',
                title: 'Hello',
                description: 'Desc',
                createGithubIssue: true,
            }),
        })

        expect(res.status).toBe(201)
        expect(createGithubIssueForCard).toHaveBeenCalledTimes(1)
        expect(createGithubIssueForCard).toHaveBeenCalledWith(
            expect.objectContaining({
                boardId: 'b1',
                cardId: 'card-1',
                title: 'Hello',
            }),
        )
        const body = (await res.json()) as any
        expect(body.githubIssueError).toBeNull()
    })

    it('does not export when project setting disables auto-create', async () => {
        const app = createApp()
        const core = await import('core' as any)
        const {createGithubIssueForCard} = await import('../src/github/export.service')

        core.projectsRepo.getColumnById.mockResolvedValueOnce({id: 'col-1', boardId: 'b1'})
        core.tasks.createBoardCard.mockResolvedValueOnce('card-1')
        core.tasks.broadcastBoard.mockResolvedValueOnce(undefined)
        core.tasks.getBoardState.mockResolvedValueOnce({columns: {}, columnOrder: [], cards: {}})
        core.projectsService.getSettings.mockResolvedValueOnce({githubIssueAutoCreateEnabled: false})

        const res = await app.request('/boards/b1/cards', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                columnId: 'col-1',
                title: 'Hello',
                createGithubIssue: true,
            }),
        })

        expect(res.status).toBe(201)
        expect(createGithubIssueForCard).not.toHaveBeenCalled()
        const body = (await res.json()) as any
        expect(body.githubIssueError).toMatch(/disabled/i)
    })
})

describe('PATCH /boards/:boardId/cards/:cardId outbound sync', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('updates GitHub issue for exported cards on title/description edit', async () => {
        const app = createApp()
        const core = await import('core' as any)
        const {updateGithubIssueForCard} = await import('../src/github/export-update.service')

        core.projectsRepo.getCardById.mockResolvedValueOnce({id: 'card-1', boardId: 'b1', columnId: 'col-1'})
        core.projectsRepo.getColumnById.mockResolvedValueOnce({id: 'col-1', boardId: 'b1', title: 'Backlog'})
        core.tasks.updateBoardCard.mockResolvedValueOnce(undefined)
        core.tasks.getBoardState.mockResolvedValueOnce({columns: {}, columnOrder: [], cards: {}})

        const res = await app.request('/boards/b1/cards/card-1', {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: 'New', description: 'Body'}),
        })

        expect(res.status).toBe(200)
        expect(updateGithubIssueForCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({title: 'New', description: 'Body'}),
        )
    })

    it('forwards isEnhanced updates without triggering GitHub sync', async () => {
        const app = createApp()
        const core = await import('core' as any)
        const {updateGithubIssueForCard} = await import('../src/github/export-update.service')

        core.projectsRepo.getCardById.mockResolvedValueOnce({id: 'card-1', boardId: 'b1', columnId: 'col-1'})
        core.projectsRepo.getColumnById.mockResolvedValueOnce({id: 'col-1', boardId: 'b1', title: 'Backlog'})
        core.tasks.updateBoardCard.mockResolvedValueOnce(undefined)
        core.tasks.getBoardState.mockResolvedValueOnce({columns: {}, columnOrder: [], cards: {}})

        const res = await app.request('/boards/b1/cards/card-1', {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({isEnhanced: true}),
        })

        expect(res.status).toBe(200)
        expect(core.tasks.updateBoardCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({isEnhanced: true}),
            expect.anything(),
        )
        expect(updateGithubIssueForCard).not.toHaveBeenCalled()
    })
})
