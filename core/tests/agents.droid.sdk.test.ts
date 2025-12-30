import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {AgentContext} from '../src/agents/types'

const mockRunStreamed = vi.fn()
const mockRun = vi.fn()
const mockStartThread = vi.fn()
const mockResumeThread = vi.fn()

class MockDroid {
    startThread = mockStartThread
    resumeThread = mockResumeThread
}

vi.mock('@activade/droid-sdk', () => ({
    Droid: MockDroid,
    isMessageEvent: (ev: unknown) => (ev as {type?: string})?.type === 'message',
    isToolCallEvent: (ev: unknown) => (ev as {type?: string})?.type === 'tool_call',
    isToolResultEvent: (ev: unknown) => (ev as {type?: string})?.type === 'tool_result',
    isTurnCompletedEvent: (ev: unknown) => (ev as {type?: string})?.type === 'completion',
    isTurnFailedEvent: (ev: unknown) => (ev as {type?: string})?.type === 'turn.failed',
    isSystemInitEvent: (ev: unknown) => {
        const e = ev as {type?: string; subtype?: string}
        return e?.type === 'system' && e?.subtype === 'init'
    },
}))

vi.mock('node:child_process', () => ({
    execFile: vi.fn((_cmd, _args, callback) => {
        callback(null, {stdout: '/usr/bin/droid\n', stderr: ''})
    }),
}))

vi.mock('node:fs', () => ({
    promises: {
        access: vi.fn().mockResolvedValue(undefined),
    },
    constants: {
        F_OK: 0,
        X_OK: 1,
    },
}))

function createMockContext(overrides: Partial<AgentContext> = {}): AgentContext {
    return {
        attemptId: 'test-attempt-1',
        boardId: 'board-1',
        cardId: 'card-1',
        worktreePath: '/tmp/worktree',
        repositoryPath: '/tmp/repo',
        branchName: 'feature/test',
        baseBranch: 'main',
        cardTitle: 'Test Card',
        cardDescription: 'Test description',
        profileId: null,
        sessionId: undefined,
        followupPrompt: undefined,
        signal: new AbortController().signal,
        emit: vi.fn(),
        ...overrides,
    }
}

async function* mockEventGenerator(events: unknown[]): AsyncGenerator<unknown> {
    for (const event of events) {
        yield event
    }
}

describe('DroidAgent SDK Integration', () => {
    beforeEach(() => {
        mockRunStreamed.mockReset()
        mockRun.mockReset()
        mockStartThread.mockReset()
        mockResumeThread.mockReset()
    })

    describe('run', () => {
        it('starts a thread and streams events', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'system', subtype: 'init', session_id: 'sess-123', cwd: '/tmp', tools: [], model: 'test'},
                {type: 'message', role: 'assistant', text: 'Hello', id: 'msg-1', timestamp: Date.now(), session_id: 'sess-123'},
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({
                    finalResponse: 'Done',
                    isError: false,
                    sessionId: 'sess-123',
                    durationMs: 100,
                    numTurns: 1,
                    items: [],
                }),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: false,
            }

            const ctx = createMockContext()
            const exitCode = await DroidAgent.run(ctx, profile)

            expect(exitCode).toBe(0)
            expect(mockStartThread).toHaveBeenCalledTimes(1)
            expect(mockRunStreamed).toHaveBeenCalledTimes(1)
            expect(ctx.emit).toHaveBeenCalled()
        })

        it('handles turn failure gracefully', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'turn.failed', error: {message: 'Something went wrong'}, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({
                    finalResponse: 'Something went wrong',
                    isError: true,
                    sessionId: 'sess-123',
                    durationMs: 50,
                    numTurns: 0,
                    items: [],
                }),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: false,
            }

            const ctx = createMockContext()
            const exitCode = await DroidAgent.run(ctx, profile)

            const emitCalls = (ctx.emit as ReturnType<typeof vi.fn>).mock.calls
            const errorEvent = emitCalls.find(
                (call) => call[0]?.type === 'conversation' && call[0]?.item?.type === 'error'
            )
            expect(errorEvent).toBeDefined()
            expect(errorEvent?.[0]?.item?.text).toBe('Something went wrong')
            expect([0, 1]).toContain(exitCode)
        })
    })

    describe('resume', () => {
        it('resumes a thread with session ID', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'message', role: 'assistant', text: 'Resumed', id: 'msg-2', timestamp: Date.now(), session_id: 'sess-123'},
                {type: 'completion', finalText: 'Done', numTurns: 2, durationMs: 150, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockResumeThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({
                    finalResponse: 'Done',
                    isError: false,
                    sessionId: 'sess-123',
                    durationMs: 150,
                    numTurns: 2,
                    items: [],
                }),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: false,
            }

            const ctx = createMockContext({
                sessionId: 'sess-123',
                followupPrompt: 'Continue please',
            })

            const exitCode = await DroidAgent.resume(ctx, profile)

            expect(exitCode).toBe(0)
            expect(mockResumeThread).toHaveBeenCalledWith('sess-123', expect.any(Object))
            expect(mockRunStreamed).toHaveBeenCalledTimes(1)
        })

        it('throws error when sessionId is missing', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: false,
            }

            const ctx = createMockContext({sessionId: undefined})

            await expect(DroidAgent.resume(ctx, profile)).rejects.toThrow('Droid resume requires sessionId')
        })
    })

    describe('threadOptions', () => {
        it('passes profile settings to startThread', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'system', subtype: 'init', session_id: 'sess-123', cwd: '/tmp', tools: [], model: 'test'},
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({
                    finalResponse: 'Done',
                    isError: false,
                    sessionId: 'sess-123',
                    durationMs: 100,
                    numTurns: 1,
                    items: [],
                }),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: 'high' as const,
                model: 'custom-model',
                reasoningEffort: 'medium' as const,
                debug: false,
            }

            const ctx = createMockContext()
            await DroidAgent.run(ctx, profile)

            expect(mockStartThread).toHaveBeenCalledWith(
                expect.objectContaining({
                    cwd: ctx.worktreePath,
                    model: 'custom-model',
                    autonomyLevel: 'high',
                    reasoningEffort: 'medium',
                })
            )
        })

        it('passes none reasoningEffort correctly', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({finalResponse: 'Done', isError: false, sessionId: 'sess-123', durationMs: 100, numTurns: 1, items: []}),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: 'medium' as const,
                model: 'test-model',
                reasoningEffort: 'none' as const,
                debug: false,
            }

            await DroidAgent.run(createMockContext(), profile)

            expect(mockStartThread).toHaveBeenCalledWith(
                expect.objectContaining({reasoningEffort: 'none'})
            )
        })

        it('uses default autonomyLevel correctly', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({finalResponse: 'Done', isError: false, sessionId: 'sess-123', durationMs: 100, numTurns: 1, items: []}),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: 'default' as const,
                model: 'test-model',
                debug: false,
            }

            await DroidAgent.run(createMockContext(), profile)

            expect(mockStartThread).toHaveBeenCalledWith(
                expect.objectContaining({autonomyLevel: 'default'})
            )
        })
    })

    describe('debug mode', () => {
        it('logs events when debug is true', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'message', role: 'assistant', text: 'Hello', id: 'msg-1', timestamp: Date.now(), session_id: 'sess-123'},
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({finalResponse: 'Done', isError: false, sessionId: 'sess-123', durationMs: 100, numTurns: 1, items: []}),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: true,
            }

            const ctx = createMockContext()
            await DroidAgent.run(ctx, profile)

            const emitCalls = (ctx.emit as ReturnType<typeof vi.fn>).mock.calls
            const debugLogs = emitCalls.filter(
                (call) => call[0]?.type === 'log' && call[0]?.message?.includes('[droid:debug]')
            )
            expect(debugLogs.length).toBeGreaterThan(0)
        })

        it('does not log events when debug is false', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'message', role: 'assistant', text: 'Hello', id: 'msg-1', timestamp: Date.now(), session_id: 'sess-123'},
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({finalResponse: 'Done', isError: false, sessionId: 'sess-123', durationMs: 100, numTurns: 1, items: []}),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: false,
            }

            const ctx = createMockContext()
            await DroidAgent.run(ctx, profile)

            const emitCalls = (ctx.emit as ReturnType<typeof vi.fn>).mock.calls
            const debugLogs = emitCalls.filter(
                (call) => call[0]?.type === 'log' && call[0]?.message?.includes('[droid:debug]')
            )
            expect(debugLogs.length).toBe(0)
        })
    })

    describe('tool events', () => {
        it('emits tool conversation items for tool_call and tool_result', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const now = Date.now()
            const events = [
                {type: 'tool_call', id: 'tc-1', messageId: 'msg-1', toolId: 'tool-1', toolName: 'bash', parameters: {command: 'ls'}, timestamp: now, session_id: 'sess-123'},
                {type: 'tool_result', id: 'tr-1', messageId: 'msg-1', toolId: 'tool-1', toolName: 'bash', isError: false, value: 'file1.txt', timestamp: now + 100, session_id: 'sess-123'},
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 200, session_id: 'sess-123', timestamp: now + 200},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({
                    finalResponse: 'Done',
                    isError: false,
                    sessionId: 'sess-123',
                    durationMs: 200,
                    numTurns: 1,
                    items: [],
                }),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                debug: false,
            }

            const ctx = createMockContext()
            await DroidAgent.run(ctx, profile)

            const emitCalls = (ctx.emit as ReturnType<typeof vi.fn>).mock.calls
            const toolEvent = emitCalls.find(
                (call) => call[0]?.type === 'conversation' && call[0]?.item?.type === 'tool'
            )
            expect(toolEvent).toBeDefined()
            expect(toolEvent?.[0]?.item?.tool?.name).toBe('bash')
            expect(toolEvent?.[0]?.item?.tool?.status).toBe('succeeded')
        })
    })

    describe('baseCommandOverride', () => {
        it('uses baseCommandOverride path when provided', async () => {
            const {DroidAgent} = await import('../src/agents/droid/core/agent')

            const events = [
                {type: 'completion', finalText: 'Done', numTurns: 1, durationMs: 100, session_id: 'sess-123', timestamp: Date.now()},
            ]

            mockStartThread.mockReturnValue({
                runStreamed: mockRunStreamed,
                id: 'sess-123',
            })

            mockRunStreamed.mockResolvedValue({
                events: mockEventGenerator(events),
                result: Promise.resolve({finalResponse: 'Done', isError: false, sessionId: 'sess-123', durationMs: 100, numTurns: 1, items: []}),
            })

            const profile = {
                appendPrompt: null,
                autonomyLevel: undefined,
                model: 'test-model',
                baseCommandOverride: '/custom/path/to/droid',
                debug: false,
            }

            const ctx = createMockContext()
            await DroidAgent.run(ctx, profile)

            const emitCalls = (ctx.emit as ReturnType<typeof vi.fn>).mock.calls
            const logEvent = emitCalls.find(
                (call) => call[0]?.type === 'log' && call[0]?.message?.includes('/custom/path/to/droid')
            )
            expect(logEvent).toBeDefined()
        })
    })
})
