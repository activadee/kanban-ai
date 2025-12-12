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
    it('sends image attachments as file parts (data URLs)', async () => {
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
        ctx.attachments = [
            {
                id: 'img-1',
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,Zm9v',
                sizeBytes: 3,
                name: 'clipboard.png',
            },
        ]

        await (OpencodeAgent as any).startSession(
            client,
            'hello',
            defaultProfile,
            ctx,
            ctx.signal,
            {mode: 'local', directory: ctx.worktreePath},
        )

        const body = promptSpy.mock.calls[0][0].body
        expect(body.parts).toHaveLength(2)
        expect(body.parts[0]).toMatchObject({type: 'text', text: 'hello'})
        expect(body.parts[0].text).not.toContain('@')
        expect(body.parts[1]).toMatchObject({
            type: 'file',
            mime: 'image/png',
            filename: 'clipboard.png',
            url: 'data:image/png;base64,Zm9v',
        })
    })

    it('sends file parts even when using a remote server', async () => {
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
        ctx.attachments = [
            {
                id: 'img-1',
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,Zm9v',
                sizeBytes: 3,
                name: 'clipboard.png',
            },
        ]

        await (OpencodeAgent as any).startSession(
            client,
            'describe',
            defaultProfile,
            ctx,
            ctx.signal,
            {mode: 'remote', directory: ctx.worktreePath, baseUrl: 'http://example'},
        )

        const body = promptSpy.mock.calls[0][0].body
        expect(body.parts).toHaveLength(2)
        expect(body.parts[0]).toMatchObject({type: 'text', text: 'describe'})
        expect(body.parts[0].text).not.toContain('@')
        expect(body.parts[1]).toMatchObject({
            type: 'file',
            mime: 'image/png',
            filename: 'clipboard.png',
            url: 'data:image/png;base64,Zm9v',
        })
    })

    it('emits a user-visible error when the selected model does not support image input', async () => {
        const promptSpy = vi.fn().mockResolvedValue({
            info: {providerID: 'prov', modelID: 'text-only'},
            parts: [],
        })
        const createSpy = vi.fn().mockResolvedValue({id: 'sess-1'})
        const emit = vi.fn()
        const client = {
            event: {
                subscribe: vi.fn().mockResolvedValue({
                    stream: (async function* () {})(),
                }),
            },
            provider: {
                list: vi.fn().mockResolvedValue({
                    all: [
                        {
                            id: 'prov',
                            name: 'Provider',
                            env: [],
                            models: {
                                'text-only': {
                                    id: 'text-only',
                                    name: 'Text Only',
                                    release_date: '2025-01-01',
                                    attachment: false,
                                    reasoning: false,
                                    temperature: true,
                                    tool_call: true,
                                    cost: {input: 0, output: 0},
                                    limit: {context: 1, output: 1},
                                    modalities: {input: ['text'], output: ['text']},
                                    options: {},
                                },
                            },
                        },
                    ],
                    default: {prov: 'text-only'},
                    connected: ['prov'],
                }),
            },
            session: {
                create: createSpy,
                prompt: promptSpy,
            },
        }

        const ctx = baseCtx()
        ctx.emit = emit as any
        ctx.attachments = [
            {
                id: 'img-1',
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,Zm9v',
                sizeBytes: 3,
                name: 'clipboard.png',
            },
        ]

        await (OpencodeAgent as any).startSession(
            client,
            'hello',
            defaultProfile,
            ctx,
            ctx.signal,
            {mode: 'local', directory: ctx.worktreePath},
        )

        expect(emit).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'conversation',
                item: expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining('does not support image input'),
                }),
            }),
        )
    })
})
