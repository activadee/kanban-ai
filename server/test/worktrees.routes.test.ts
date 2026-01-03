import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import {createWorktreesRouter} from '../src/worktrees/worktrees.routes'

const mockBoard = {
    id: 'project-1',
    name: 'test-project',
    repositoryPath: '/path/to/repo',
}

const mockAttempt = {
    id: 'attempt-1',
    boardId: 'project-1',
    cardId: 'card-1',
    worktreePath: '/path/to/worktree',
    branchName: 'feature/test',
    baseBranch: 'main',
    status: 'done',
    agent: 'codex',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
}

const mockCard = {
    id: 'card-1',
    columnId: 'column-done',
    title: 'Test Card',
    ticketKey: 'TEST-1',
}

const mockColumn = {
    id: 'column-done',
    title: 'Done',
}

vi.mock('core', () => {
    return {
        projectsRepo: {
            getBoardById: vi.fn(async (id: string) => {
                if (id === 'project-1') return mockBoard
                return null
            }),
            getCardById: vi.fn(async (id: string) => {
                if (id === 'card-1') return mockCard
                return null
            }),
            getColumnById: vi.fn(async (id: string) => {
                if (id === 'column-done') return mockColumn
                return null
            }),
        },
        attemptsRepo: {
            listAttemptsForBoard: vi.fn(async (_boardId: string) => [mockAttempt]),
            getAttemptById: vi.fn(async (id: string) => {
                if (id === 'attempt-1') return mockAttempt
                return null
            }),
            updateAttempt: vi.fn(async () => {}),
        },
        git: {
            removeWorktreeAtPath: vi.fn(async () => {}),
            deleteBranch: vi.fn(async () => {}),
            deleteRemoteBranch: vi.fn(async () => {}),
        },
    }
})

vi.mock('../src/fs/worktree-runner', () => ({
    removeWorktree: vi.fn(async () => {}),
}))

vi.mock('../src/fs/paths', () => ({
    getProjectWorktreeFolder: vi.fn(() => '/home/user/.cache/kanban-ai/worktrees/test-project'),
}))

vi.mock('fs/promises', () => ({
    readdir: vi.fn(async () => []),
    stat: vi.fn(async () => ({mtime: new Date(), size: 1024})),
    rm: vi.fn(async () => {}),
}))

vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
}))

const createApp = () => {
    const app = new Hono()
    app.route('/projects/:projectId/worktrees', createWorktreesRouter())
    return app
}

describe('GET /projects/:projectId/worktrees', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns worktrees list for valid project', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees')

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.projectId).toBe('project-1')
        expect(body.projectName).toBe('test-project')
        expect(body.summary).toBeDefined()
        expect(body.tracked).toBeDefined()
        expect(body.orphaned).toBeDefined()
        expect(body.stale).toBeDefined()
    })

    it('returns 404 for non-existent project', async () => {
        const app = createApp()
        const res = await app.request('/projects/invalid-project/worktrees')

        expect(res.status).toBe(404)
    })
})

describe('POST /projects/:projectId/worktrees/sync', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('syncs worktrees and returns summary', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/sync', {
            method: 'POST',
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.syncedAt).toBeDefined()
        expect(body.summary).toBeDefined()
        expect(typeof body.newOrphaned).toBe('number')
        expect(typeof body.newStale).toBe('number')
    })

    it('returns 404 for non-existent project', async () => {
        const app = createApp()
        const res = await app.request('/projects/invalid-project/worktrees/sync', {
            method: 'POST',
        })

        expect(res.status).toBe(404)
    })
})

describe('DELETE /projects/:projectId/worktrees/:id', () => {
    beforeEach(async () => {
        const {projectsRepo} = await import('core')
        ;(projectsRepo.getColumnById as any).mockReset()
        ;(projectsRepo.getColumnById as any).mockImplementation(async (id: string) => {
            if (id === 'column-done') return mockColumn
            return null
        })
    })

    it('deletes worktree when card is in Done column', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.deletedPath).toBe('/path/to/worktree')
    })

    it('returns 404 for non-existent worktree', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/invalid-id', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(404)
    })

    it('returns 404 when worktree belongs to different project', async () => {
        const app = createApp()
        const res = await app.request('/projects/different-project/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(404)
    })

    it('returns 409 when trying to delete active worktree without force', async () => {
        const {projectsRepo} = await import('core')
        ;(projectsRepo.getColumnById as any).mockResolvedValueOnce({
            id: 'column-progress',
            title: 'In Progress',
        })

        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(409)

        const body = await res.json()
        expect(body.cardActive).toBe(true)
    })

    it('allows force delete of active worktree', async () => {
        const {projectsRepo} = await import('core')
        ;(projectsRepo.getColumnById as any).mockResolvedValueOnce({
            id: 'column-progress',
            title: 'In Progress',
        })

        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({force: true}),
        })

        expect(res.status).toBe(200)
    })

    it('deletes worktree with branch deletion options', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                deleteBranch: true,
                deleteRemoteBranch: true,
            }),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.deletedPath).toBe('/path/to/worktree')
    })

    it('accepts deleteBranch without deleteRemoteBranch', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                deleteBranch: true,
                deleteRemoteBranch: false,
            }),
        })

        expect(res.status).toBe(200)
    })

    it('accepts deleteRemoteBranch without deleteBranch', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                deleteBranch: false,
                deleteRemoteBranch: true,
            }),
        })

        expect(res.status).toBe(200)
    })

    it('accepts all options together (force + branch deletion)', async () => {
        const {projectsRepo} = await import('core')
        ;(projectsRepo.getColumnById as any).mockResolvedValueOnce({
            id: 'column-progress',
            title: 'In Progress',
        })

        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                force: true,
                deleteBranch: true,
                deleteRemoteBranch: true,
            }),
        })

        expect(res.status).toBe(200)
    })
})

describe('DELETE /projects/:projectId/worktrees/orphaned/:encodedPath', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deletes orphaned worktree with confirmation', async () => {
        const encodedPath = encodeURIComponent('/home/user/.cache/kanban-ai/worktrees/test-project/orphaned-worktree')
        const app = createApp()
        const res = await app.request(`/projects/project-1/worktrees/orphaned/${encodedPath}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({confirm: true}),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.success).toBe(true)
    })

    it('returns 400 without confirmation', async () => {
        const encodedPath = encodeURIComponent('/home/user/.cache/kanban-ai/worktrees/test-project/orphaned-worktree')
        const app = createApp()
        const res = await app.request(`/projects/project-1/worktrees/orphaned/${encodedPath}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({confirm: false}),
        })

        expect(res.status).toBe(400)
    })
})

describe('DELETE /projects/:projectId/worktrees/stale/:id', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('cleans up stale entry with confirmation', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/stale/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({confirm: true}),
        })

        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.success).toBe(true)

        const {attemptsRepo} = await import('core')
        expect(attemptsRepo.updateAttempt).toHaveBeenCalledWith('attempt-1', {worktreePath: null})
    })

    it('returns 400 without confirmation', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/stale/attempt-1', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({confirm: false}),
        })

        expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent stale entry', async () => {
        const app = createApp()
        const res = await app.request('/projects/project-1/worktrees/stale/invalid-id', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({confirm: true}),
        })

        expect(res.status).toBe(404)
    })
})
