import {afterEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'

import {createAttemptsRouter} from '../src/attempts/routes'

const mocks = vi.hoisted(() => ({
    followupAttempt: vi.fn(async () => {}),
    getAttempt: vi.fn(async () => ({
        id: 'att-1',
        cardId: 'card-1',
        boardId: 'board-1',
        agent: 'OPENCODE',
        status: 'succeeded',
        baseBranch: 'main',
        branchName: 'main',
        worktreePath: '/tmp/worktree',
        sessionId: 'sess-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })),
}))

vi.mock('core', () => {
    return {
        attempts: {
            getAttempt: mocks.getAttempt,
            followupAttempt: mocks.followupAttempt,
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

describe('POST /attempts/:id/messages body size cap', () => {
    const prev = process.env.KANBANAI_MAX_FOLLOWUP_BODY_BYTES

    afterEach(() => {
        mocks.followupAttempt.mockClear()
        mocks.getAttempt.mockClear()
        if (prev === undefined) delete process.env.KANBANAI_MAX_FOLLOWUP_BODY_BYTES
        else process.env.KANBANAI_MAX_FOLLOWUP_BODY_BYTES = prev
    })

    it('returns 413 when the request body exceeds the configured limit', async () => {
        process.env.KANBANAI_MAX_FOLLOWUP_BODY_BYTES = '200'
        const app = createApp()
        const bigPrompt = 'x'.repeat(1000)
        const res = await app.request('/attempts/att-1/messages', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: bigPrompt}),
        })

        expect(res.status).toBe(413)
        expect(mocks.followupAttempt).not.toHaveBeenCalled()
    })
})
