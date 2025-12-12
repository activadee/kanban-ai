import {afterEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {createAttemptsRouter} from '../src/attempts/routes'

const tmpRoot = join(process.cwd(), '.bun-tmp', 'attempts-attachments-test')

const mocks = vi.hoisted(() => ({
    getAttempt: vi.fn(async (_id: string) => ({
        id: 'att-1',
        cardId: 'card-1',
        boardId: 'board-1',
        agent: 'OPENCODE',
        status: 'succeeded',
        baseBranch: 'main',
        branchName: 'main',
        worktreePath: tmpRoot,
        sessionId: 'sess-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })),
}))

vi.mock('core', () => {
    return {
        attempts: {
            getAttempt: mocks.getAttempt,
            listAttemptLogs: vi.fn(async () => []),
        },
        git: {
            getFileContentAtPath: vi.fn(async () => ''),
            getStatusAgainstBaseAtPath: vi.fn(async () => ({})),
            resolveBaseAncestorAtPath: vi.fn(async () => 'HEAD'),
            commitAtPath: vi.fn(async () => 'deadbeef'),
            pushAtPath: vi.fn(async () => {}),
            mergeBranchIntoBaseForProject: vi.fn(async () => {}),
        },
        githubRepo: {
            getGithubConnection: vi.fn(async () => null),
        },
        tasks: {
            broadcastBoard: vi.fn(async () => {}),
        },
        projectsRepo: {
            getCardById: vi.fn(async () => ({columnId: 'col-1'})),
            getColumnById: vi.fn(async () => ({title: 'todo'})),
            updateCard: vi.fn(async () => {}),
        },
        projectDeps: {
            isCardBlocked: vi.fn(async () => ({blocked: false})),
        },
        settingsService: {
            snapshot: () => ({editorType: 'VS_CODE'}),
        },
    }
})

const createApp = () => {
    const app = new Hono()
    app.route('/attempts', createAttemptsRouter())
    return app
}

describe('GET /attempts/:id/attachments/:fileName', () => {
    afterEach(() => {
        try {
            rmSync(tmpRoot, {recursive: true, force: true})
        } catch {}
    })

    it('serves stored attachments as binary responses', async () => {
        const attemptId = 'att-1'
        const fileName = 'img-1.png'
        const dir = join(tmpRoot, '.kanbanai', 'attachments', attemptId)
        mkdirSync(dir, {recursive: true})
        writeFileSync(join(dir, fileName), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

        const app = createApp()
        const res = await app.request(`/attempts/${attemptId}/attachments/${fileName}`)

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('image/png')
        const buf = Buffer.from(await res.arrayBuffer())
        expect(buf.length).toBeGreaterThan(0)
    })
})
