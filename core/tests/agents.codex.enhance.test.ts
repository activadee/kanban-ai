import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import type {PrSummaryInlineInput, TicketEnhanceInput} from '../src/agents/types'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt} from '../src/agents/utils'
import {defaultProfile} from '../src/agents/codex/profiles/schema'

const runMock = vi.fn()
const startThreadMock = vi.fn(() => ({
    run: runMock,
}))

class CodexMock {
    startThread = startThreadMock
}

vi.mock('@openai/codex-sdk', () => ({
    Codex: CodexMock,
}))

const originalEnv = {
    override: process.env.CODEX_PATH_OVERRIDE,
    path: process.env.CODEX_PATH,
}

describe('CodexAgent.enhance', () => {
    beforeAll(() => {
        process.env.CODEX_PATH_OVERRIDE = process.execPath
        delete process.env.CODEX_PATH
    })

    afterAll(() => {
        process.env.CODEX_PATH_OVERRIDE = originalEnv.override
        process.env.CODEX_PATH = originalEnv.path
    })

    beforeEach(() => {
        runMock.mockReset()
        startThreadMock.mockReset()
    })

    it('builds a ticket-enhancement prompt and splits markdown output', async () => {
        const {CodexAgent} = await import('../src/agents/codex/core/agent')

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

        const prompt = buildTicketEnhancePrompt(
            input,
            (defaultProfile as any).inlineProfile ?? defaultProfile.appendPrompt ?? undefined,
        )
        const markdown = '# Enhanced Title\nEnhanced body'

        runMock.mockResolvedValue({
            items: [],
            finalResponse: markdown,
            usage: null,
        })

        const result = await (CodexAgent as any).enhance(input, defaultProfile)

        expect(startThreadMock).toHaveBeenCalledTimes(1)

        const threadOptions = startThreadMock.mock.calls[0][0]
        expect(threadOptions.workingDirectory).toBe(input.repositoryPath)

        expect(runMock).toHaveBeenCalledTimes(1)
        const [promptArg, turnOptions] = runMock.mock.calls[0] as [string, {signal: AbortSignal}]
        expect(promptArg).toBe(prompt)
        expect(turnOptions.signal).toBe(input.signal)

        expect(result).toEqual({
            title: 'Enhanced Title',
            description: 'Enhanced body',
        })
    })

    it('forwards modelReasoningEffort including xhigh to the Codex SDK', async () => {
        const {CodexAgent} = await import('../src/agents/codex/core/agent')

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
            ...defaultProfile,
            modelReasoningEffort: 'xhigh',
        }

        runMock.mockResolvedValue({
            items: [],
            finalResponse: '# Enhanced Title\nEnhanced body',
            usage: null,
        })

        await (CodexAgent as any).enhance(input, profile)

        expect(startThreadMock).toHaveBeenCalledTimes(1)
        const threadOptions = startThreadMock.mock.calls[0][0] as {modelReasoningEffort?: string}
        expect(threadOptions.modelReasoningEffort).toBe('xhigh')
    })
})

describe('CodexAgent.summarizePullRequest', () => {
    beforeAll(() => {
        process.env.CODEX_PATH_OVERRIDE = process.execPath
        delete process.env.CODEX_PATH
    })

    afterAll(() => {
        process.env.CODEX_PATH_OVERRIDE = originalEnv.override
        process.env.CODEX_PATH = originalEnv.path
    })

    beforeEach(() => {
        runMock.mockReset()
        startThreadMock.mockReset()
    })

    it('builds a PR-summary prompt and maps markdown to title/body', async () => {
        const {CodexAgent} = await import('../src/agents/codex/core/agent')

        const controller = new AbortController()
        const input: PrSummaryInlineInput = {
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
            commitSummary: 'abc123 Add feature',
            diffSummary: '3 files changed',
        }

        const prompt = buildPrSummaryPrompt(
            input,
            (defaultProfile as any).inlineProfile ?? defaultProfile.appendPrompt ?? undefined,
        )
        const markdown = '# PR Title\nPR body'

        runMock.mockResolvedValue({
            items: [],
            finalResponse: markdown,
            usage: null,
        })

        const result = await (CodexAgent as any).summarizePullRequest(input, defaultProfile, controller.signal)

        expect(startThreadMock).toHaveBeenCalledTimes(1)

        const threadOptions = startThreadMock.mock.calls[0][0]
        expect(threadOptions.workingDirectory).toBe(input.repositoryPath)

        expect(runMock).toHaveBeenCalledTimes(1)
        const [promptArg, turnOptions] = runMock.mock.calls[0] as [string, {signal: AbortSignal}]
        expect(promptArg).toBe(prompt)
        expect(turnOptions.signal).toBe(controller.signal)

        expect(result).toEqual({
            title: 'PR Title',
            body: 'PR body',
        })
    })
})
