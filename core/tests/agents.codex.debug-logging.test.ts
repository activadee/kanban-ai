import {describe, expect, it} from 'vitest'

import type {AgentContext} from '../src/agents/types'
import {CodexAgent} from '../src/agents/codex/core/agent'
import {defaultProfile, type CodexProfile} from '../src/agents/codex/profiles/schema'

const baseCtx = (events: Array<{type: string; [key: string]: any}>): AgentContext => {
    const controller = new AbortController()
    return {
        attemptId: 'att-codex-debug',
        boardId: 'board-1',
        cardId: 'card-1',
        worktreePath: '/tmp',
        repositoryPath: '/tmp',
        branchName: 'main',
        baseBranch: 'main',
        cardTitle: 't',
        cardDescription: null,
        profileId: 'ap-1',
        sessionId: undefined,
        followupPrompt: undefined,
        signal: controller.signal,
        emit: (event) => {
            events.push(event as any)
        },
    }
}

const parseDebugJson = (message: string) => {
    const prefix = '[codex:debug] '
    expect(message.startsWith(prefix)).toBe(true)
    return JSON.parse(message.slice(prefix.length))
}

describe('CodexAgent debug logging', () => {
    it('emits structured debug logs for SDK events when profile.debug=true', () => {
        const events: Array<{type: string; [key: string]: any}> = []
        const ctx = baseCtx(events)
        const profile: CodexProfile = {...defaultProfile, debug: true}

        ;(CodexAgent as any).handleEvent(
            {type: 'turn.completed', usage: {input_tokens: 1, cached_input_tokens: 2, output_tokens: 3}},
            ctx,
            profile,
        )

        const log = events.find((e) => e.type === 'log' && typeof e.message === 'string' && e.message.startsWith('[codex:debug] '))
        expect(log).toBeTruthy()

        const parsed = parseDebugJson((log as any).message)
        expect(parsed.event).toBe('turn.completed')
        expect(parsed.usage).toEqual({input_tokens: 1, cached_input_tokens: 2, output_tokens: 3})
        expect(parsed.attemptId).toBe('att-codex-debug')
        expect(typeof parsed.ts).toBe('string')
    })

    it('does not emit debug logs when profile.debug is falsy', () => {
        const events: Array<{type: string; [key: string]: any}> = []
        const ctx = baseCtx(events)
        const profile: CodexProfile = {...defaultProfile, debug: false}

        ;(CodexAgent as any).handleEvent(
            {type: 'turn.completed', usage: {input_tokens: 1, cached_input_tokens: 2, output_tokens: 3}},
            ctx,
            profile,
        )

        const debugLogs = events.filter((e) => e.type === 'log' && typeof e.message === 'string' && e.message.startsWith('[codex:debug] '))
        expect(debugLogs).toHaveLength(0)
    })

    it('redacts common secret patterns in debug previews', () => {
        const events: Array<{type: string; [key: string]: any}> = []
        const ctx = baseCtx(events)
        const profile: CodexProfile = {...defaultProfile, debug: true}

        ;(CodexAgent as any).handleEvent(
            {
                type: 'item.started',
                item: {
                    id: 'cmd-1',
                    type: 'command_execution',
                    command:
                        'curl -H \"Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz123456\" https://example.com && echo OPENAI_API_KEY=sk-secret1234567890',
                    aggregated_output: '',
                    status: 'in_progress',
                },
            },
            ctx,
            profile,
        )

        const log = events.find((e) => e.type === 'log' && typeof e.message === 'string' && e.message.startsWith('[codex:debug] '))
        expect(log).toBeTruthy()

        const parsed = parseDebugJson((log as any).message)
        expect(parsed.event).toBe('item.started')
        expect(parsed.item?.type).toBe('command_execution')
        expect(String(parsed.item?.command_preview)).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz')
        expect(String(parsed.item?.command_preview)).toContain('Authorization: Bearer <redacted>')
        expect(String(parsed.item?.command_preview)).not.toContain('sk-secret')
        expect(String(parsed.item?.command_preview)).toContain('OPENAI_API_KEY=<redacted>')
    })

    it('redacts github_pat_ tokens in debug previews', () => {
        const events: Array<{type: string; [key: string]: any}> = []
        const ctx = baseCtx(events)
        const profile: CodexProfile = {...defaultProfile, debug: true}

        ;(CodexAgent as any).handleEvent(
            {
                type: 'item.started',
                item: {
                    id: 'cmd-2',
                    type: 'command_execution',
                    command: 'echo github_pat_11AA22BB33CC44DD55EE66FF77GG88HH99',
                    aggregated_output: '',
                    status: 'in_progress',
                },
            },
            ctx,
            profile,
        )

        const log = events.find((e) => e.type === 'log' && typeof e.message === 'string' && e.message.startsWith('[codex:debug] '))
        expect(log).toBeTruthy()

        const parsed = parseDebugJson((log as any).message)
        expect(parsed.item?.type).toBe('command_execution')
        expect(String(parsed.item?.command_preview)).toContain('github_pat_<redacted>')
        expect(String(parsed.item?.command_preview)).not.toContain('github_pat_11AA22')
    })
})
