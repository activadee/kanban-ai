import {describe, expect, it, vi} from 'vitest'

import type {AgentContext} from '../src/agents/types'
import {OpencodeAgent} from '../src/agents/opencode/core/agent'
import {defaultProfile} from '../src/agents/opencode/profiles/schema'

describe('OpencodeAgent prompt error handling', () => {
    it('emits a conversation error when session.prompt throws', async () => {
        const events: any[] = []
        const controller = new AbortController()
        const ctx: AgentContext = {
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
            emit: (evt) => {
                events.push(evt)
            },
        }

        const client = {
            event: {
                subscribe: vi.fn().mockResolvedValue({
                    stream: (async function* () {})(),
                }),
            },
            session: {
                create: vi.fn().mockResolvedValue({id: 'sess-1'}),
                prompt: vi.fn().mockRejectedValue(new Error('boom')),
            },
        }

        await expect(
            (OpencodeAgent as any).startSession(
                client,
                'hello',
                defaultProfile,
                ctx,
                ctx.signal,
                {mode: 'remote', directory: ctx.worktreePath, baseUrl: 'http://example'},
            ),
        ).rejects.toThrow('boom')

        const conversationErrors = events.filter((e) => e.type === 'conversation' && e.item?.type === 'error')
        expect(conversationErrors.length).toBe(1)
        expect(conversationErrors[0].item.text).toContain('boom')
    })

    it('emits a conversation error when event stream throws', async () => {
        const events: any[] = []
        const controller = new AbortController()
        const ctx: AgentContext = {
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
            emit: (evt) => events.push(evt),
        }

        async function* brokenStream() {
            throw new Error('stream boom')
        }

        const client = {
            event: {
                subscribe: vi.fn().mockResolvedValue({
                    stream: brokenStream(),
                }),
            },
            session: {
                create: vi.fn().mockResolvedValue({id: 'sess-1'}),
                prompt: vi.fn().mockResolvedValue({}),
            },
        }

        await expect(
            (OpencodeAgent as any).startSession(
                client,
                'hello',
                defaultProfile,
                ctx,
                ctx.signal,
                {mode: 'remote', directory: ctx.worktreePath, baseUrl: 'http://example'},
            ),
        ).resolves.toBeTruthy()

        const conversationErrors = events.filter((e) => e.type === 'conversation' && e.item?.type === 'error')
        expect(conversationErrors.length).toBe(1)
        expect(conversationErrors[0].item.text).toContain('stream boom')
    })
})
