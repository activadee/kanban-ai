import {describe, expect, it, vi} from 'vitest'

import type {AgentContext} from '../src/agents/types'
import {OpencodeAgent} from '../src/agents/opencode/core/agent'
import {defaultProfile} from '../src/agents/opencode/profiles/schema'

const baseCtx = (): AgentContext => {
    const controller = new AbortController()
    return {
        attemptId: 'att',
        boardId: 'board',
        cardId: 'card',
        worktreePath: '/tmp/worktree',
        repositoryPath: '/tmp/worktree',
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

describe('OpencodeAgent image input wiring', () => {
    it('adds @file references to text parts when images are present', async () => {
        const promptSpy = vi.fn().mockResolvedValue({})
        const createSpy = vi.fn().mockResolvedValue({id: 'sess-1'})
        const client = {
            event: {
                subscribe: vi.fn().mockResolvedValue({
                    stream: (async function* () {})(),
                }),
            },
            session: {
                create: createSpy,
                prompt: promptSpy,
            },
        }

        const ctx = baseCtx()
        ctx.images = [
            {
                path: '/tmp/worktree/.kanbanai/attachments/att/img.png',
                mimeType: 'image/png',
                sizeBytes: 10,
            },
        ]

        await (OpencodeAgent as any).startSession(
            client,
            'hello',
            defaultProfile,
            ctx,
            ctx.signal,
            {mode: 'remote', directory: ctx.worktreePath, baseUrl: 'http://example'},
        )

        const body = promptSpy.mock.calls[0][0].body
        expect(body.parts).toHaveLength(1)
        expect(body.parts[0]).toMatchObject({type: 'text'})
        expect(body.parts[0].text).toContain('hello')
        expect(body.parts[0].text).toContain('@.kanbanai/attachments/att/img.png')
    })
})
