import {describe, expect, it, vi} from 'vitest'

import type {AgentContext} from '../src/agents/types'
import {CodexAgent} from '../src/agents/codex/core/agent'
import {defaultProfile} from '../src/agents/codex/profiles/schema'

const baseCtx = (): AgentContext => {
    const controller = new AbortController()
    return {
        attemptId: 'att',
        boardId: 'board',
        cardId: 'card',
        worktreePath: '/tmp/work',
        repositoryPath: '/tmp/work',
        branchName: 'main',
        baseBranch: 'main',
        cardTitle: 't',
        cardDescription: null,
        profileId: null,
        sessionId: undefined,
        followupPrompt: undefined,
        attachments: undefined,
        images: undefined,
        signal: controller.signal,
        emit: () => {},
    }
}

describe('CodexAgent image input wiring', () => {
    it('uses structured input when images are present', async () => {
        const runStreamed = vi.fn().mockResolvedValue({
            events: (async function* () {})(),
        })
        const thread = {runStreamed, id: 'thread-1'}
        const codex = {
            startThread: vi.fn(() => thread),
            resumeThread: vi.fn(() => thread),
        }

        const ctx = baseCtx()
        ctx.images = [{path: '/tmp/a.png', mimeType: 'image/png', sizeBytes: 10}]

        await (CodexAgent as any).startSession(
            codex,
            'hello',
            defaultProfile,
            ctx,
            ctx.signal,
            {executablePath: process.execPath},
        )

        expect(runStreamed).toHaveBeenCalledWith(
            [
                {type: 'text', text: 'hello'},
                {type: 'local_image', path: '/tmp/a.png'},
            ],
            expect.anything(),
        )
    })

    it('adds a default prompt when prompt is empty but images are present', async () => {
        const runStreamed = vi.fn().mockResolvedValue({
            events: (async function* () {})(),
        })
        const thread = {runStreamed, id: 'thread-1'}
        const codex = {
            startThread: vi.fn(() => thread),
            resumeThread: vi.fn(() => thread),
        }

        const ctx = baseCtx()
        ctx.images = [{path: '/tmp/a.png', mimeType: 'image/png', sizeBytes: 10}]

        await (CodexAgent as any).startSession(
            codex,
            '',
            defaultProfile,
            ctx,
            ctx.signal,
            {executablePath: process.execPath},
        )

        expect(runStreamed).toHaveBeenCalledWith(
            [
                {type: 'text', text: expect.stringContaining('describe')},
                {type: 'local_image', path: '/tmp/a.png'},
            ],
            expect.anything(),
        )
    })
})
