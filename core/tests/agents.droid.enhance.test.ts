import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {PrSummaryInlineInput, TicketEnhanceInput} from '../src/agents/types'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt} from '../src/agents/utils'

const mockRun = vi.fn()
const mockStartThread = vi.fn()

class MockDroid {
    startThread = mockStartThread
}

vi.mock('@activade/droid-sdk', () => ({
    Droid: MockDroid,
    isMessageEvent: vi.fn(),
    isToolCallEvent: vi.fn(),
    isToolResultEvent: vi.fn(),
    isTurnCompletedEvent: vi.fn(),
    isTurnFailedEvent: vi.fn(),
    isSystemInitEvent: vi.fn(),
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

describe('DroidAgent.enhance', () => {
    beforeEach(() => {
        mockRun.mockReset()
        mockStartThread.mockReset()
        mockStartThread.mockReturnValue({
            run: mockRun,
            id: 'test-session-id',
        })
    })

    it('builds a text-only prompt and splits markdown output', async () => {
        const {DroidAgent} = await import('../src/agents/droid/core/agent')

        const controller = new AbortController()
        const input: TicketEnhanceInput = {
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            profileId: 'ap-1',
            signal: controller.signal,
        }

        const profile = {
            appendPrompt: null,
            inlineProfile: null,
            model: 'test-model',
            autonomyLevel: 'low' as const,
            reasoningEffort: 'low' as const,
            baseCommandOverride: null,
            debug: false,
        }

        const expectedPrompt = buildTicketEnhancePrompt(input, profile.inlineProfile ?? profile.appendPrompt ?? undefined)

        mockRun.mockResolvedValue({
            finalResponse: '# Enhanced Title\nEnhanced body',
            isError: false,
            sessionId: 'test-session-id',
            durationMs: 100,
            numTurns: 1,
            items: [],
        })

        const result = await (DroidAgent as any).enhance(input, profile)

        expect(mockStartThread).toHaveBeenCalledTimes(1)
        expect(mockRun).toHaveBeenCalledTimes(1)
        expect(mockRun).toHaveBeenCalledWith(expectedPrompt)

        expect(result).toEqual({
            title: 'Enhanced Title',
            description: 'Enhanced body',
        })
    })
})

describe('DroidAgent.summarizePullRequest', () => {
    beforeEach(() => {
        mockRun.mockReset()
        mockStartThread.mockReset()
        mockStartThread.mockReturnValue({
            run: mockRun,
            id: 'test-session-id',
        })
    })

    it('builds a PR-summary prompt and maps markdown to title/body', async () => {
        const {DroidAgent} = await import('../src/agents/droid/core/agent')

        const controller = new AbortController()
        const input: PrSummaryInlineInput = {
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
            commitSummary: 'abc123 Add feature',
            diffSummary: '3 files changed',
        }

        const profile = {
            appendPrompt: null,
            inlineProfile: null,
            model: 'test-model',
            autonomyLevel: 'low' as const,
            reasoningEffort: 'low' as const,
            baseCommandOverride: null,
            debug: false,
        }

        const expectedPrompt = buildPrSummaryPrompt(input, profile.inlineProfile ?? profile.appendPrompt ?? undefined)

        mockRun.mockResolvedValue({
            finalResponse: '# PR Title\nPR body',
            isError: false,
            sessionId: 'test-session-id',
            durationMs: 100,
            numTurns: 1,
            items: [],
        })

        const result = await (DroidAgent as any).summarizePullRequest(input, profile, controller.signal)

        expect(mockStartThread).toHaveBeenCalledTimes(1)
        expect(mockRun).toHaveBeenCalledTimes(1)
        expect(mockRun).toHaveBeenCalledWith(expectedPrompt)

        expect(result).toEqual({
            title: 'PR Title',
            body: 'PR body',
        })
    })
})
