import {execFile} from 'node:child_process'
import {promises as fs, constants as fsConstants} from 'node:fs'
import {promisify} from 'node:util'

import {
    Codex,
    type ThreadEvent,
    type CommandExecutionItem,
    type AgentMessageItem,
    type ReasoningItem,
    type McpToolCallItem,
    type FileChangeItem,
    type WebSearchItem,
    type TodoListItem,
    type ErrorItem,
    type ThreadOptions,
} from '@openai/codex-sdk'
import type {
    AgentContext,
    InlineTaskContext,
    InlineTaskInputByKind,
    InlineTaskKind,
    InlineTaskResultByKind,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import type {AttemptTodoSummary} from 'shared'
import {SdkAgent} from '../../sdk'
import type {CodexProfile} from '../profiles/schema'
import {CodexProfileSchema, defaultProfile} from '../profiles/schema'
import {StreamGrouper} from '../../sdk/stream-grouper'
import {buildTicketEnhancePrompt, splitTicketMarkdown} from '../../utils'

type CodexInstallation = { executablePath: string }
const execFileAsync = promisify(execFile)

class CodexImpl extends SdkAgent<CodexProfile, CodexInstallation> {
    key = 'CODEX'
    label = 'Codex Agent'
    defaultProfile = defaultProfile
    profileSchema = CodexProfileSchema
    capabilities = {resume: true}

    private groupers = new Map<string, StreamGrouper>()
    private execOutputs = new Map<string, string>()

    private async verifyExecutable(path: string): Promise<string> {
        const candidate = path.trim()
        if (!candidate.length) throw new Error('codex executable path is empty')
        const mode = process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK
        try {
            await fs.access(candidate, mode)
            return candidate
        } catch (err) {
            throw new Error(`codex executable not accessible at ${candidate}: ${String(err)}`)
        }
    }

    private async locateExecutable(): Promise<string> {
        const envPath = process.env.CODEX_PATH_OVERRIDE ?? process.env.CODEX_PATH
        if (envPath) return this.verifyExecutable(envPath)

        const locator = process.platform === 'win32' ? 'where' : 'which'
        try {
            const {stdout} = await execFileAsync(locator, ['codex'])
            const candidate = stdout
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .at(0)

            if (candidate) return this.verifyExecutable(candidate)
        } catch (err) {
            // swallow and fall through to unified error below
            void err
        }

        throw new Error('codex executable not found. Install the Codex CLI and ensure it is on PATH or set CODEX_PATH/CODEX_PATH_OVERRIDE.')
    }

    protected async detectInstallation(_profile: CodexProfile, ctx: AgentContext): Promise<CodexInstallation> {
        const executablePath = await this.locateExecutable()
        ctx.emit({type: 'log', level: 'info', message: `[${this.key}] using codex executable: ${executablePath}`})
        return {executablePath}
    }

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

    protected async createClient(profile: CodexProfile, _ctx: AgentContext, installation: CodexInstallation) {
        const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.CODEX_BASE_URL
        const apiKey = process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY
        const codexPathOverride = installation.executablePath
        return new Codex({baseUrl, apiKey, codexPathOverride})
    }

    protected async startSession(
        client: unknown,
        prompt: string,
        profile: CodexProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        _installation: CodexInstallation,
    ) {
        const codex = client as Codex
        const thread = codex.startThread(this.threadOptions(profile, ctx))
        const {events} = await thread.runStreamed(prompt, {outputSchema: profile.outputSchema, signal})
        return {stream: events as AsyncIterable<unknown>, sessionId: thread.id ?? undefined}
    }

    protected async resumeSession(
        client: unknown,
        prompt: string,
        sessionId: string,
        profile: CodexProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        _installation: CodexInstallation,
    ) {
        const codex = client as Codex
        const thread = codex.resumeThread(sessionId, this.threadOptions(profile, ctx))
        const {events} = await thread.runStreamed(prompt, {outputSchema: profile.outputSchema, signal})
        return {stream: events as AsyncIterable<unknown>, sessionId: thread.id ?? undefined}
    }

    private getGrouper(id: string) {
        if (!this.groupers.has(id)) this.groupers.set(id, new StreamGrouper({emitThinkingImmediately: true}))
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
        g.appendReasoning(ctx, item.text)
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

        const todos: AttemptTodoSummary = (() => {
            const items = (item.items ?? []).map((t, index) => {
                const text = (t as any).text ?? ''
                const completed = Boolean((t as any).completed)
                const idSource = (t as any).id
                const id =
                    typeof idSource === 'string' && idSource.trim().length
                        ? idSource
                        : `todo-${index}`
                return {
                    id,
                    text,
                    status: completed ? 'done' : 'open',
                } as const
            })
            const total = items.length
            const completedCount = items.filter((t) => t.status === 'done').length
            return {
                total,
                completed: completedCount,
                items,
            }
        })()

        ctx.emit({type: 'todo', todos})
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
        this.groupers.set(ctx.attemptId, new StreamGrouper({emitThinkingImmediately: true}))
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
        this.groupers.set(ctx.attemptId, new StreamGrouper({emitThinkingImmediately: true}))
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

    async inline<K extends InlineTaskKind>(
        kind: K,
        input: InlineTaskInputByKind[K],
        profile: CodexProfile,
        _opts?: {context: InlineTaskContext; signal?: AbortSignal},
    ): Promise<InlineTaskResultByKind[K]> {
        if (kind === 'ticketEnhance') {
            const result = await this.enhance(input as TicketEnhanceInput, profile)
            return result as InlineTaskResultByKind[K]
        }
        throw new Error(`Codex inline kind ${kind} is not implemented`)
    }

    async enhance(input: TicketEnhanceInput, profile: CodexProfile): Promise<TicketEnhanceResult> {
        const enhanceCtx: AgentContext = {
            attemptId: 'enhance-' + input.projectId,
            boardId: input.boardId,
            cardId: 'ticket',
            worktreePath: input.repositoryPath,
            repositoryPath: input.repositoryPath,
            branchName: input.baseBranch,
            baseBranch: input.baseBranch,
            cardTitle: input.title,
            cardDescription: input.description,
            profileId: input.profileId ?? null,
            sessionId: undefined,
            followupPrompt: undefined,
            signal: input.signal,
            emit: () => {},
        }

        const installation = await this.detectInstallation(profile, enhanceCtx)
        const client = await this.createClient(profile, enhanceCtx, installation)
        const codex = client as Codex
        const thread = codex.startThread(this.threadOptions(profile, enhanceCtx))

        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        const baseAppend = typeof profile.appendPrompt === 'string' ? profile.appendPrompt : null
        const effectiveAppend = inline.length > 0 ? inline : baseAppend
        const prompt = buildTicketEnhancePrompt(input, effectiveAppend ?? undefined)
        const turn = await thread.run(prompt, {signal: input.signal})
        const markdown = (turn.finalResponse || '').trim()
        if (!markdown) {
            return {title: input.title, description: input.description}
        }
        return splitTicketMarkdown(markdown, input.title, input.description)
    }
}

export const CodexAgent = new CodexImpl()
