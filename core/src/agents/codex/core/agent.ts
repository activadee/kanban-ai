import {Codex, type ThreadEvent, type CommandExecutionItem, type AgentMessageItem, type ReasoningItem, type McpToolCallItem, type FileChangeItem, type WebSearchItem, type TodoListItem, type ErrorItem, type ThreadOptions} from '@openai/codex-sdk'
import type {AgentContext} from '../../types'
import {SdkAgent} from '../../sdk'
import type {CodexProfile} from '../profiles/schema'
import {CodexProfileSchema, defaultProfile} from '../profiles/schema'
import {StreamGrouper} from '../../sdk/stream-grouper'

class CodexImpl extends SdkAgent<CodexProfile> {
    key = 'CODEX'
    label = 'Codex Agent'
    defaultProfile = defaultProfile
    profileSchema = CodexProfileSchema
    capabilities = {resume: true}

    private groupers = new Map<string, StreamGrouper>()
    private execOutputs = new Map<string, string>()

    private threadOptions(profile: CodexProfile, ctx: AgentContext): ThreadOptions {
        return {
            model: profile.model,
            sandboxMode: profile.sandbox && profile.sandbox !== 'auto' ? profile.sandbox : undefined,
            workingDirectory: ctx.worktreePath,
            skipGitRepoCheck: profile.skipGitRepoCheck ?? true,
            modelReasoningEffort: profile.modelReasoningEffort,
            networkAccessEnabled: profile.networkAccessEnabled,
            webSearchEnabled: profile.webSearchEnabled,
            approvalPolicy: profile.approvalPolicy,
            additionalDirectories: profile.additionalDirectories,
        }
    }

    protected async createClient(profile: CodexProfile, _ctx: AgentContext) {
        const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.CODEX_BASE_URL
        const apiKey = process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY
        const codexPathOverride = process.env.CODEX_PATH_OVERRIDE ?? process.env.CODEX_PATH
        return new Codex({baseUrl, apiKey, codexPathOverride})
    }

    protected async startSession(client: unknown, prompt: string, profile: CodexProfile, ctx: AgentContext, signal: AbortSignal) {
        const codex = client as Codex
        const thread = codex.startThread(this.threadOptions(profile, ctx))
        const {events} = await thread.runStreamed(prompt, {outputSchema: profile.outputSchema, signal})
        return {stream: events as AsyncIterable<unknown>, sessionId: thread.id ?? undefined}
    }

    protected async resumeSession(client: unknown, prompt: string, sessionId: string, profile: CodexProfile, ctx: AgentContext, signal: AbortSignal) {
        const codex = client as Codex
        const thread = codex.resumeThread(sessionId, this.threadOptions(profile, ctx))
        const {events} = await thread.runStreamed(prompt, {outputSchema: profile.outputSchema, signal})
        return {stream: events as AsyncIterable<unknown>, sessionId: thread.id ?? undefined}
    }

    private getGrouper(id: string) {
        if (!this.groupers.has(id)) this.groupers.set(id, new StreamGrouper())
        return this.groupers.get(id) as StreamGrouper
    }

    private handleAgentMessage(item: AgentMessageItem, ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        g.flushReasoning(ctx)
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'message',
                timestamp: new Date().toISOString(),
                role: 'assistant',
                text: item.text,
                format: 'markdown',
                profileId: ctx.profileId ?? null,
            },
        })
    }

    private handleReasoning(item: ReasoningItem, ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        g.appendReasoning(item.text)
    }

    private handleCommand(item: CommandExecutionItem, eventType: ThreadEvent['type'], ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        if (eventType === 'item.started') {
            g.execBegin(item.id, {cmd: item.command})
            this.execOutputs.set(item.id, '')
            return
        }
        const prev = this.execOutputs.get(item.id) ?? ''
        const agg = item.aggregated_output ?? ''
        if (agg && agg.length > prev.length) {
            const delta = agg.slice(prev.length)
            g.execAppend(item.id, 'stdout', delta)
            this.execOutputs.set(item.id, agg)
        }
        if (eventType === 'item.completed') {
            const info = g.execEnd(item.id)
            this.execOutputs.delete(item.id)
            if (info) {
                const status = item.status === 'failed' ? 'failed' : 'succeeded'
                ctx.emit({type: 'conversation', item: g.buildExecItem(info, {status, exitCode: item.exit_code})})
            }
        }
    }

    private handleMcp(item: McpToolCallItem, eventType: ThreadEvent['type'], ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        if (eventType === 'item.started') {
            g.mcpBegin(item.id, {server: item.server, tool: item.tool, args: item.arguments})
            return
        }
        if (eventType === 'item.completed') {
            const info = g.mcpEnd(item.id)
            if (info) {
                const status = item.status === 'failed' ? 'failed' : 'succeeded'
                ctx.emit({
                    type: 'conversation',
                    item: g.buildMcpItem(info, {
                        status,
                        metadata: item.result ? {result: item.result} : item.error ? {error: item.error} : undefined,
                    }),
                })
            }
        }
    }

    private handleFileChange(item: FileChangeItem, ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        g.flushReasoning(ctx)
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'tool',
                timestamp: new Date().toISOString(),
                tool: {
                    name: 'file_change',
                    action: 'apply_patch',
                    status: item.status === 'failed' ? 'failed' : 'succeeded',
                    metadata: {changes: item.changes},
                },
            },
        })
    }

    private handleWebSearch(item: WebSearchItem, ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        g.flushReasoning(ctx)
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'tool',
                timestamp: new Date().toISOString(),
                tool: {
                    name: 'web_search',
                    action: 'query',
                    status: 'succeeded',
                    metadata: {query: item.query},
                },
            },
        })
    }

    private handleTodo(item: TodoListItem, ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        g.flushReasoning(ctx)
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'message',
                timestamp: new Date().toISOString(),
                role: 'assistant',
                text: ['To-do list:', ...item.items.map((t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`)].join('\n'),
                format: 'markdown',
                profileId: ctx.profileId ?? null,
            },
        })
    }

    private handleError(item: ErrorItem, ctx: AgentContext) {
        const g = this.getGrouper(ctx.attemptId)
        g.flushReasoning(ctx)
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'error',
                timestamp: new Date().toISOString(),
                text: item.message,
            },
        })
    }

    protected handleEvent(event: unknown, ctx: AgentContext, profile: CodexProfile): void {
        if (!event || typeof event !== 'object' || typeof (event as { type?: unknown }).type !== 'string') return
        const ev = event as ThreadEvent
        if (ev.type === 'thread.started') {
            ctx.emit({type: 'log', level: 'info', message: `[codex] thread ${ev.thread_id}`})
            ctx.emit({type: 'session', id: ev.thread_id})
            return
        }
        if (ev.type === 'turn.failed') {
            ctx.emit({type: 'conversation', item: {type: 'error', timestamp: new Date().toISOString(), text: ev.error.message}})
            return
        }
        if (ev.type === 'turn.started' || ev.type === 'turn.completed') return

        if ('item' in ev && ev.item && typeof ev.item === 'object') {
            const item = ev.item as
                | AgentMessageItem
                | ReasoningItem
                | CommandExecutionItem
                | McpToolCallItem
                | FileChangeItem
                | WebSearchItem
                | TodoListItem
                | ErrorItem

            switch (item.type) {
                case 'agent_message':
                    this.handleAgentMessage(item, ctx)
                    break
                case 'reasoning':
                    this.handleReasoning(item, ctx)
                    break
                case 'command_execution':
                    this.handleCommand(item, ev.type, ctx)
                    break
                case 'mcp_tool_call':
                    this.handleMcp(item, ev.type, ctx)
                    break
                case 'file_change':
                    if (ev.type === 'item.completed') this.handleFileChange(item, ctx)
                    break
                case 'web_search':
                    if (ev.type === 'item.completed') this.handleWebSearch(item, ctx)
                    break
                case 'todo_list':
                    if (ev.type === 'item.completed' || ev.type === 'item.updated') this.handleTodo(item, ctx)
                    break
                case 'error':
                    this.handleError(item, ctx)
                    break
                default:
                    ctx.emit({type: 'log', level: 'info', message: `[codex] unhandled item ${(item as {type?: string}).type ?? 'unknown'}`})
            }
        }
    }

    async run(ctx: AgentContext, profile: CodexProfile): Promise<number> {
        this.groupers.set(ctx.attemptId, new StreamGrouper())
        const prompt = this.buildPrompt(profile, ctx)
        if (prompt) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: new Date().toISOString(),
                    role: 'user',
                    text: prompt,
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                },
            })
        }
        try {
            return await super.run(ctx, profile)
        } finally {
            this.groupers.get(ctx.attemptId)?.flush(ctx)
            this.groupers.delete(ctx.attemptId)
        }
    }

    async resume(ctx: AgentContext, profile: CodexProfile): Promise<number> {
        this.groupers.set(ctx.attemptId, new StreamGrouper())
        const prompt = (ctx.followupPrompt ?? '').trim()
        if (prompt.length) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: new Date().toISOString(),
                    role: 'user',
                    text: prompt,
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                },
            })
        }
        try {
            return await super.resume(ctx, profile)
        } finally {
            this.groupers.get(ctx.attemptId)?.flush(ctx)
            this.groupers.delete(ctx.attemptId)
        }
    }
}

export const CodexAgent = new CodexImpl()
