import {describe, expect, it} from 'vitest'

import type {AgentContext} from '../src/agents/types'
import {OpencodeImpl, type OpencodeInstallation} from '../src/agents/opencode/core/agent'
import type {OpencodeProfile} from '../src/agents/opencode/profiles/schema'
import type {
    AssistantMessage,
    EventMessagePartUpdated,
    EventMessageUpdated,
    OpencodeClient,
    ReasoningPart,
    TextPart,
    EventTodoUpdated,
    Todo,
} from '@opencode-ai/sdk'

type RecordedEvent = { type: string; [key: string]: unknown }

const baseCtx = (): AgentContext & {events: RecordedEvent[]} => {
    const controller = new AbortController()
    const events: RecordedEvent[] = []
    const emit: AgentContext['emit'] = (evt) => {
        events.push({...evt})
    }
    return {
        attemptId: 'att-opencode',
        boardId: 'board',
        cardId: 'card',
        worktreePath: '/tmp/worktree',
        repositoryPath: '/tmp/worktree',
        branchName: 'main',
        baseBranch: 'main',
        cardTitle: 'Test card',
        cardDescription: 'Body',
        ticketType: null,
        profileId: 'profile-1',
        sessionId: undefined,
        followupPrompt: undefined,
        signal: controller.signal,
        emit,
        events,
    }
}

class TestOpencodeAgent extends OpencodeImpl {
    lastPrompt: string | null = null
    streamEvents: Array<EventMessageUpdated | EventMessagePartUpdated | EventTodoUpdated> = []

    protected override async detectInstallation(_profile: OpencodeProfile, ctx: AgentContext): Promise<OpencodeInstallation> {
        return {mode: 'remote', directory: ctx.worktreePath, baseUrl: 'http://example', apiKey: 'test-key'}
    }

    protected override async createClient(
        _profile: OpencodeProfile,
        _ctx: AgentContext,
        _installation: OpencodeInstallation,
    ): Promise<OpencodeClient> {
        return {} as OpencodeClient
    }

    protected override async startSession(
        _client: unknown,
        prompt: string,
        _profile: OpencodeProfile,
        _ctx: AgentContext,
        _signal: AbortSignal,
        _installation: OpencodeInstallation,
    ) {
        this.lastPrompt = prompt
        const events = this.streamEvents
        async function* stream() {
            for (const ev of events) {
                yield ev
            }
        }
        return {stream: stream(), sessionId: 'sess-opencode'}
    }

    protected override async resumeSession(
        _client: unknown,
        prompt: string,
        sessionId: string,
        _profile: OpencodeProfile,
        _ctx: AgentContext,
        _signal: AbortSignal,
        _installation: OpencodeInstallation,
    ) {
        this.lastPrompt = prompt
        const events = this.streamEvents
        async function* stream() {
            for (const ev of events) {
                yield ev
            }
        }
        return {stream: stream(), sessionId}
    }
}

describe('OpencodeAgent prompt construction', () => {
    it('builds prompt from title, description, and appendPrompt', async () => {
        const agent = new TestOpencodeAgent()
        const ctx = baseCtx()
        const profile: OpencodeProfile = {
            appendPrompt: 'Extra instructions',
        }

        const code = await agent.run(ctx, profile)

        expect(code).toBe(0)
        expect(agent.lastPrompt).toBe('Test card\n\nBody\n\nExtra instructions')
        const userMessages = ctx.events.filter(
            (e) => e.type === 'conversation' && (e as {item?: {role?: string}}).item?.role === 'user',
        )
        expect(userMessages.length).toBe(1)
    })

    it('uses followupPrompt in resume', async () => {
        const agent = new TestOpencodeAgent()
        const ctx = baseCtx()
        ctx.sessionId = 'sess-existing'
        ctx.followupPrompt = 'Follow up'

        const code = await agent.resume(ctx, {appendPrompt: 'ignored'})

        expect(code).toBe(0)
        expect(agent.lastPrompt).toBe('Follow up')
        const userMessages = ctx.events.filter(
            (e) => e.type === 'conversation' && (e as {item?: {role?: string}}).item?.role === 'user',
        )
        expect(userMessages.length).toBe(1)
    })
})

describe('OpencodeAgent event mapping', () => {
    it('converts text parts into assistant messages via OpencodeGrouper', async () => {
        const agent = new TestOpencodeAgent()
        const ctx = baseCtx()
        ctx.sessionId = 'sess-1'

        const assistantMessage: AssistantMessage = {
            id: 'msg-1',
            sessionID: 'sess-1',
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: ctx.worktreePath, root: ctx.worktreePath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const updatedEvent: EventMessageUpdated = {
            type: 'message.updated',
            properties: {info: assistantMessage},
        }

        const part: TextPart = {
            id: 'part-1',
            sessionID: 'sess-1',
            messageID: 'msg-1',
            type: 'text',
            text: 'Hello from OpenCode',
        }
        const event: EventMessagePartUpdated = {
            type: 'message.part.updated',
            properties: {part},
        }

        agent.streamEvents = [updatedEvent, event]
        const code = await agent.run(ctx, {appendPrompt: null})
        expect(code).toBe(0)

        const assistantMessages = ctx.events.filter(
            (e) => e.type === 'conversation' && (e as {item?: {role?: string}}).item?.role === 'assistant',
        )
        expect(assistantMessages.length).toBe(1)
        const text = (assistantMessages[0] as {item?: {text?: string}}).item?.text
        expect(text).toContain('Hello from OpenCode')
    })

    it('converts reasoning parts into thinking conversation items', async () => {
        const agent = new TestOpencodeAgent()
        const ctx = baseCtx()
        ctx.sessionId = 'sess-1'

        const assistantMessage: AssistantMessage = {
            id: 'msg-1',
            sessionID: 'sess-1',
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: ctx.worktreePath, root: ctx.worktreePath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const updatedEvent: EventMessageUpdated = {
            type: 'message.updated',
            properties: {info: assistantMessage},
        }

        const part: ReasoningPart = {
            id: 'part-r1',
            sessionID: 'sess-1',
            messageID: 'msg-1',
            type: 'reasoning',
            text: 'Some private reasoning',
            time: {start: Date.now(), end: Date.now()},
        }
        const event: EventMessagePartUpdated = {
            type: 'message.part.updated',
            properties: {part},
        }

        agent.streamEvents = [updatedEvent, event]
        const code = await agent.run(ctx, {appendPrompt: null})
        expect(code).toBe(0)

        const thinkingItems = ctx.events.filter(
            (e) => e.type === 'conversation' && (e as {item?: {type?: string}}).item?.type === 'thinking',
        )
        expect(thinkingItems.length).toBe(1)
        const text = (thinkingItems[0] as {item?: {text?: string}}).item?.text
        expect(text).toContain('Some private reasoning')
    })

    it('maps todo.updated events into AttemptTodoSummary', async () => {
        const agent = new TestOpencodeAgent()
        const ctx = baseCtx()
        ctx.sessionId = 'sess-2'

        const todos: Todo[] = [
            {id: 'a', content: 'Do thing', status: 'pending', priority: 'medium'},
            {id: 'b', content: 'Done thing', status: 'completed', priority: 'low'},
        ]
        const event: EventTodoUpdated = {
            type: 'todo.updated',
            properties: {sessionID: 'sess-2', todos},
        }

        agent.streamEvents = [event]
        const code = await agent.run(ctx, {appendPrompt: null})
        expect(code).toBe(0)

        const todoEvents = ctx.events.filter((e) => e.type === 'todo')
        expect(todoEvents.length).toBe(1)
        const payload = todoEvents[0] as {todos?: {total: number; completed: number}}
        expect(payload.todos?.total).toBe(2)
        expect(payload.todos?.completed).toBe(1)
    })
})
