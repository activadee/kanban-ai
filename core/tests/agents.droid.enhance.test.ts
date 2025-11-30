import {beforeEach, describe, expect, it, vi} from 'vitest'
import {EventEmitter} from 'node:events'

import type {PrSummaryInlineInput, TicketEnhanceInput} from '../src/agents/types'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt} from '../src/agents/utils'

const buildDroidCommand = vi.fn()

vi.mock('../src/agents/droid/profiles/build', () => ({
    buildDroidCommand,
    buildDroidFollowupCommand: vi.fn(),
}))

const spawnMock = vi.fn()

vi.mock('child_process', () => ({
    spawn: spawnMock,
}))

describe('DroidAgent.enhance', () => {
    beforeEach(() => {
        buildDroidCommand.mockReset()
        spawnMock.mockReset()
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
            autonomy: 'read-only',
            model: 'test-model',
            reasoningEffort: 'low',
            baseCommandOverride: null,
            additionalParams: [],
            debug: false,
        }

        const expectedPrompt = buildTicketEnhancePrompt(input, profile.inlineProfile ?? profile.appendPrompt ?? undefined)
        const expectedQuoted = `"${expectedPrompt.replace(/"/g, '\\"')}"`

        buildDroidCommand.mockImplementation((_cfg, prompt, format) => {
            return {
                base: 'droid',
                params: ['-o', format, prompt],
                env: {NO_COLOR: '1'},
            }
        })

        spawnMock.mockImplementation(() => {
            const child = new EventEmitter() as any
            child.stdout = new EventEmitter()
            child.stderr = new EventEmitter()
            child.stdin = {
                write: vi.fn(),
                end: vi.fn(),
            }
            child.pid = 123
            child.killed = false
            child.kill = vi.fn()

            setTimeout(() => {
                child.stdout.emit('data', '# Enhanced Title\nEnhanced body')
                child.stdout.emit('end')
                child.emit('close', 0)
            }, 0)

            return child
        })

        const result = await (DroidAgent as any).enhance(input, profile)

        expect(buildDroidCommand).toHaveBeenCalledTimes(1)
        const [cfgArg, promptArg, formatArg] = buildDroidCommand.mock.calls[0] as [any, string, string]
        expect(cfgArg).toBe(profile)
        expect(formatArg).toBe('text')
        expect(promptArg).toBe(expectedQuoted)

        expect(result).toEqual({
            title: 'Enhanced Title',
            description: 'Enhanced body',
        })
    })
})

describe('DroidAgent.summarizePullRequest', () => {
    beforeEach(() => {
        buildDroidCommand.mockReset()
        spawnMock.mockReset()
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
            autonomy: 'read-only',
            model: 'test-model',
            reasoningEffort: 'low',
            baseCommandOverride: null,
            additionalParams: [],
            debug: false,
        }

        const expectedPrompt = buildPrSummaryPrompt(input, profile.inlineProfile ?? profile.appendPrompt ?? undefined)
        const expectedQuoted = `"${expectedPrompt.replace(/"/g, '\\"')}"`

        buildDroidCommand.mockImplementation((_cfg, prompt, format) => {
            return {
                base: 'droid',
                params: ['-o', format, prompt],
                env: {NO_COLOR: '1'},
            }
        })

        spawnMock.mockImplementation(() => {
            const child = new EventEmitter() as any
            child.stdout = new EventEmitter()
            child.stderr = new EventEmitter()
            child.stdin = {
                write: vi.fn(),
                end: vi.fn(),
            }
            child.pid = 123
            child.killed = false
            child.kill = vi.fn()

            setTimeout(() => {
                child.stdout.emit('data', '# PR Title\nPR body')
                child.stdout.emit('end')
                child.emit('close', 0)
            }, 0)

            return child
        })

        const result = await (DroidAgent as any).summarizePullRequest(input, profile, controller.signal)

        expect(buildDroidCommand).toHaveBeenCalledTimes(1)
        const [cfgArg, promptArg, formatArg] = buildDroidCommand.mock.calls[0] as [any, string, string]
        expect(cfgArg).toBe(profile)
        expect(formatArg).toBe('text')
        expect(promptArg).toBe(expectedQuoted)

        expect(result).toEqual({
            title: 'PR Title',
            body: 'PR body',
        })
    })
})
