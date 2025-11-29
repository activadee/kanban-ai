import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import type {TicketEnhanceInput} from '../src/agents/types'
import {buildTicketEnhancePrompt} from '../src/agents/utils'
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
})
