import {describe, expect, it, vi} from 'vitest'
import {z} from 'zod'

import type {AgentContext} from '../src/agents/types'
import {SdkAgent, type AgentInstallInfo} from '../src/agents/sdk'

type TestProfile = { appendPrompt?: string }
type TestInstall = AgentInstallInfo & { path: string }

const schema = z.object({appendPrompt: z.string().optional()})

const baseCtx = () => {
    const controller = new AbortController()
    const events: Array<{ type: string; [k: string]: unknown }> = []

    const emit: AgentContext['emit'] = (evt) => {
        events.push({type: evt.type, ...evt})
    }

    const ctx: AgentContext & {events: typeof events} = {
        attemptId: 'att-1',
        boardId: 'board-1',
        cardId: 'card-1',
        worktreePath: '/tmp/work',
        repositoryPath: '/tmp/work',
        branchName: 'main',
        baseBranch: 'main',
        cardTitle: 'Test Card',
        cardDescription: 'Do the thing',
        profileId: 'profile-1',
        sessionId: undefined,
        followupPrompt: undefined,
        signal: controller.signal,
        emit,
        events,
    }

    return ctx
}

class TestAgent extends SdkAgent<TestProfile, TestInstall> {
    key = 'TEST'
    label = 'Test Agent'
    defaultProfile = {}
    profileSchema = schema
    capabilities = {resume: true}

    calls: string[] = []
    events: unknown[] = []

    protected async detectInstallation(_profile: TestProfile, _ctx: AgentContext): Promise<TestInstall> {
        this.calls.push('detect')
        return {path: '/bin/test', executablePath: '/bin/test'}
    }

    protected async createClient(_profile: TestProfile, _ctx: AgentContext, install: TestInstall) {
        this.calls.push(`create:${install.path}`)
        return {install}
    }

    protected async startSession(
        _client: unknown,
        prompt: string,
        _profile: TestProfile,
        _ctx: AgentContext,
        _signal: AbortSignal,
        install: TestInstall,
    ) {
        this.calls.push(`start:${install.path}:${prompt.slice(0, 4)}`)
        async function* stream() {
            yield {hello: 'world'}
            yield {done: true}
        }
        return {stream: stream(), sessionId: 'sess-run'}
    }

    protected async resumeSession(
        _client: unknown,
        prompt: string,
        _sessionId: string,
        _profile: TestProfile,
        _ctx: AgentContext,
        _signal: AbortSignal,
        install: TestInstall,
    ) {
        this.calls.push(`resume:${install.path}:${prompt || 'empty'}`)
        async function* stream() {
            yield {again: true}
        }
        return {stream: stream(), sessionId: 'sess-resume'}
    }

    protected handleEvent(event: unknown, _ctx: AgentContext, _profile: TestProfile): void {
        this.events.push(event)
        this.calls.push('event')
    }
}

class FailingDetectAgent extends TestAgent {
    protected override async detectInstallation(): Promise<TestInstall> {
        this.calls.push('detect')
        throw new Error('missing binary')
    }
}

describe('SdkAgent run/resume wiring', () => {
    it('passes installation info through run workflow', async () => {
        const agent = new TestAgent()
        const ctx = baseCtx()

        const code = await agent.run(ctx, {})

        expect(code).toBe(0)
        expect(agent.calls).toEqual(['detect', 'create:/bin/test', 'start:/bin/test:Test', 'event', 'event'])

        const statusEvents = ctx.events.filter((evt) => evt.type === 'status').map((evt) => (evt as any).status)
        expect(statusEvents).toContain('running')
        expect(statusEvents).toContain('completed')

        expect(agent.events).toEqual([{hello: 'world'}, {done: true}])
    })

    it('passes installation info through resume workflow', async () => {
        const agent = new TestAgent()
        const ctx = baseCtx()
        ctx.sessionId = 'sess-existing'
        ctx.followupPrompt = 'continue'

        const code = await agent.resume(ctx, {})

        expect(code).toBe(0)
        expect(agent.calls).toEqual(['detect', 'create:/bin/test', 'resume:/bin/test:continue', 'event'])
        expect(agent.events).toEqual([{again: true}])
    })

    it('fails early when installation detection throws', async () => {
        const agent = new FailingDetectAgent()
        const ctx = baseCtx()

        const code = await agent.run(ctx, {})

        expect(code).toBe(1)
        expect(agent.calls).toEqual(['detect'])
    })
})
