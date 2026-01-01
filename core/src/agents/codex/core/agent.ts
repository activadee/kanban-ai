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
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import type {AttemptTodoSummary} from 'shared'
import {SdkAgent} from '../../sdk'
import type {CodexProfile} from '../profiles/schema'
import {CodexProfileSchema, defaultProfile} from '../profiles/schema'
import {StreamGrouper} from '../../sdk/stream-grouper'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown, saveImagesToTempFiles} from '../../utils'

type CodexInstallation = { executablePath: string }
const execFileAsync = promisify(execFile)
const nowIso = () => new Date().toISOString()

const normalizeForLog = (value: string) => value.replace(/\s+/g, ' ').trim()

const redactSecrets = (value: string) => {
    let out = value
    // Common "VAR=secret" patterns.
    out = out.replace(/\b(OPENAI_API_KEY|CODEX_API_KEY|OPENCODE_API_KEY|GITHUB_TOKEN)=\S+/g, '$1=<redacted>')
    // Authorization headers (best-effort).
    out = out.replace(/\bAuthorization\s*:\s*(Bearer|Token)\s+([^\s"']+)/gi, (_m, scheme: string) => {
        return `Authorization: ${scheme} <redacted>`
    })
    out = out.replace(/\bAuthorization\s*:\s*(token)\s+([^\s"']+)/gi, () => {
        return 'Authorization: token <redacted>'
    })
    // GitHub PAT formats (best-effort).
    out = out.replace(/\bgithub_pat_[a-zA-Z0-9_]{10,}\b/g, 'github_pat_<redacted>')
    out = out.replace(/\bgh[pous]_[a-zA-Z0-9_]{10,}\b/g, 'ghp_<redacted>')
    // Common OpenAI-style API keys (best-effort).
    out = out.replace(/\bsk-[a-zA-Z0-9_-]{10,}\b/g, 'sk-<redacted>')
    return out
}

const previewForLog = (value: string, maxLen: number) => {
    // Avoid O(n) work for very large strings: slice first, then normalize/redact.
    const prefixLen = Math.max(0, maxLen + 64)
    const prefix = value.slice(0, prefixLen)
    const cleaned = redactSecrets(normalizeForLog(prefix))
    const truncated = value.length > maxLen
    if (cleaned.length <= maxLen) return truncated ? cleaned + '...' : cleaned
    return cleaned.slice(0, maxLen) + '...'
}

const summarizeUnknown = (value: unknown): {kind: string; keys?: string[]; length?: number} => {
    if (value === null) return {kind: 'null'}
    if (value === undefined) return {kind: 'undefined'}
    if (typeof value === 'string') return {kind: 'string', length: value.length}
    if (typeof value === 'number') return {kind: 'number'}
    if (typeof value === 'boolean') return {kind: 'boolean'}
    if (Array.isArray(value)) return {kind: 'array', length: value.length}
    if (typeof value === 'object') return {kind: 'object', keys: Object.keys(value as Record<string, unknown>).slice(0, 12)}
    return {kind: typeof value}
}

class CodexImpl extends SdkAgent<CodexProfile, CodexInstallation> {
    key = 'CODEX'
    label = 'Codex Agent'
    defaultProfile = defaultProfile
    profileSchema = CodexProfileSchema
    capabilities = {resume: true}

    private groupers = new Map<string, StreamGrouper>()
    private execOutputs = new Map<string, string>()

    private safeStringify(value: unknown): string {
        try {
            const seen = new WeakSet<object>()
            return JSON.stringify(value, (_key, val) => {
                if (typeof val === 'bigint') return String(val)
                if (typeof val === 'function') return '[Function]'
                if (val && typeof val === 'object') {
                    if (seen.has(val)) return '[Circular]'
                    seen.add(val)
                }
                return val
            })
        } catch (err) {
            return JSON.stringify({
                event: 'debug.serialize_failed',
                error: String(err),
                payload: summarizeUnknown(value),
            })
        }
    }

    private debug(
        profile: CodexProfile,
        ctx: AgentContext,
        payload: Record<string, unknown> | (() => Record<string, unknown>) | string | (() => string),
    ) {
        if (!profile.debug) return
        const computed = typeof payload === 'function' ? payload() : payload
        if (typeof computed === 'string') {
            ctx.emit({type: 'log', level: 'info', message: `[codex:debug] ${computed}`})
            return
        }
        const base = {
            ts: nowIso(),
            attemptId: ctx.attemptId,
            boardId: ctx.boardId,
            cardId: ctx.cardId,
            profileId: ctx.profileId ?? null,
            ...computed,
        }
        const serialized = this.safeStringify(base)
        ctx.emit({type: 'log', level: 'info', message: `[codex:debug] ${serialized}`})
    }

    private summarizeThreadEvent(ev: ThreadEvent): Record<string, unknown> {
        const base: Record<string, unknown> = {event: ev.type}
        if (ev.type === 'thread.started') {
            return {...base, thread_id: ev.thread_id}
        }
        if (ev.type === 'turn.started') {
            return base
        }
        if (ev.type === 'turn.completed') {
            return {
                ...base,
                usage: {
                    input_tokens: ev.usage.input_tokens,
                    cached_input_tokens: ev.usage.cached_input_tokens,
                    output_tokens: ev.usage.output_tokens,
                },
            }
        }
        if (ev.type === 'turn.failed') {
            return {...base, error: {message: ev.error.message}}
        }
        if (ev.type === 'error') {
            return {...base, error: {message: ev.message}}
        }

        if (ev.type === 'item.started' || ev.type === 'item.updated' || ev.type === 'item.completed') {
            const item = ev.item
            const baseItem: Record<string, unknown> = {id: item.id, type: item.type}
            const common: Record<string, unknown> = {
                ...base,
                item: baseItem,
            }

            switch (item.type) {
                case 'agent_message':
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            text_len: item.text.length,
                            text_preview: previewForLog(item.text, 120),
                        },
                    }
                case 'reasoning':
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            text_len: item.text.length,
                        },
                    }
                case 'command_execution':
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            status: item.status,
                            exit_code: item.exit_code ?? null,
                            command_preview: previewForLog(item.command, 200),
                            aggregated_output_len: (item.aggregated_output ?? '').length,
                        },
                    }
                case 'mcp_tool_call':
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            status: item.status,
                            server: item.server,
                            tool: item.tool,
                            arguments: summarizeUnknown(item.arguments),
                            result: item.result
                                ? {
                                      content_len: Array.isArray(item.result.content) ? item.result.content.length : 0,
                                      structured_content: summarizeUnknown(item.result.structured_content),
                                  }
                                : null,
                            error: item.error ? {message: previewForLog(item.error.message, 200)} : null,
                        },
                    }
                case 'file_change': {
                    const max = 20
                    const changes = (item.changes ?? []).slice(0, max).map((c) => ({path: c.path, kind: c.kind}))
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            status: item.status,
                            changes_count: (item.changes ?? []).length,
                            changes,
                            changes_truncated: (item.changes ?? []).length > max,
                        },
                    }
                }
                case 'web_search':
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            query_len: item.query.length,
                            query_preview: previewForLog(item.query, 160),
                        },
                    }
                case 'todo_list': {
                    const items = item.items ?? []
                    const completed = items.filter((t) => Boolean((t as any).completed)).length
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            items_total: items.length,
                            items_completed: completed,
                        },
                    }
                }
                case 'error':
                    return {
                        ...common,
                        item: {
                            ...baseItem,
                            message_len: item.message.length,
                            message_preview: previewForLog(item.message, 200),
                        },
                    }
                default:
                    return common
            }
        }

        return base
    }

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
        const reasoningEffort = profile.modelReasoningEffort
        const options: ThreadOptions = {
            model: profile.model,
            sandboxMode: profile.sandbox && profile.sandbox !== 'auto' ? profile.sandbox : undefined,
            workingDirectory: ctx.worktreePath,
            skipGitRepoCheck: profile.skipGitRepoCheck ?? true,
            modelReasoningEffort: reasoningEffort as ThreadOptions['modelReasoningEffort'],
            networkAccessEnabled: profile.networkAccessEnabled,
            webSearchEnabled: profile.webSearchEnabled,
            approvalPolicy: profile.approvalPolicy,
            additionalDirectories: profile.additionalDirectories,
        }
        this.debug(profile, ctx, () => ({
            event: 'thread.options',
            model: options.model ?? null,
            sandboxMode: options.sandboxMode ?? 'auto',
            workingDirectory: options.workingDirectory,
            skipGitRepoCheck: options.skipGitRepoCheck ?? null,
            modelReasoningEffort: options.modelReasoningEffort ?? null,
            networkAccessEnabled: options.networkAccessEnabled ?? null,
            webSearchEnabled: options.webSearchEnabled ?? null,
            approvalPolicy: options.approvalPolicy ?? null,
            additionalDirectories_count: Array.isArray(options.additionalDirectories) ? options.additionalDirectories.length : 0,
        }))
        return options
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
        this.debug(profile, ctx, () => ({
            event: 'session.start',
            prompt_len: typeof prompt === 'string' ? prompt.length : null,
        }))
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
        const hasImages = ctx.images && ctx.images.length > 0
        this.debug(profile, ctx, () => ({
            event: 'session.resume',
            sessionId,
            prompt_len: typeof prompt === 'string' ? prompt.length : null,
            image_count: hasImages ? ctx.images!.length : 0,
        }))
        const thread = codex.resumeThread(sessionId, this.threadOptions(profile, ctx))

        let input: string | Array<{type: 'text'; text: string} | {type: 'local_image'; path: string}> = prompt
        if (hasImages) {
            const imagePaths = await saveImagesToTempFiles(ctx.images!, `codex-${ctx.attemptId}`)
            input = [
                {type: 'text' as const, text: prompt},
                ...imagePaths.map((path) => ({type: 'local_image' as const, path})),
            ]
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[codex] including ${imagePaths.length} image(s) in followup`,
            })
        }

        const {events} = await thread.runStreamed(input, {outputSchema: profile.outputSchema, signal})
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
        this.debug(profile, ctx, () => this.summarizeThreadEvent(ev))
        if (ev.type === 'thread.started') {
            ctx.emit({type: 'log', level: 'info', message: `[codex] thread ${ev.thread_id}`})
            ctx.emit({type: 'session', id: ev.thread_id})
            return
        }
        if (ev.type === 'error') {
            ctx.emit({type: 'log', level: 'error', message: `[codex] sdk error: ${ev.message}`})
            ctx.emit({type: 'conversation', item: {type: 'error', timestamp: nowIso(), text: ev.message}})
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
        if (prompt.length || (ctx.images && ctx.images.length > 0)) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: new Date().toISOString(),
                    role: 'user',
                    text: prompt || '(image attached)',
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                    images: ctx.images,
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
        if (kind === 'prSummary') {
            const result = await this.summarizePullRequest(
                input as PrSummaryInlineInput,
                profile,
                _opts?.signal,
            )
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

    async summarizePullRequest(
        input: PrSummaryInlineInput,
        profile: CodexProfile,
        signal?: AbortSignal,
    ): Promise<PrSummaryInlineResult> {
        const summaryCtx: AgentContext = {
            attemptId: `pr-summary-${input.repositoryPath}`,
            boardId: 'pr-summary',
            cardId: 'pr',
            worktreePath: input.repositoryPath,
            repositoryPath: input.repositoryPath,
            branchName: input.headBranch,
            baseBranch: input.baseBranch,
            cardTitle: `PR from ${input.headBranch} into ${input.baseBranch}`,
            cardDescription: undefined,
            profileId: null,
            sessionId: undefined,
            followupPrompt: undefined,
            signal: signal ?? new AbortController().signal,
            emit: () => {},
        }

        const installation = await this.detectInstallation(profile, summaryCtx)
        const client = await this.createClient(profile, summaryCtx, installation)
        const codex = client as Codex
        const thread = codex.startThread(this.threadOptions(profile, summaryCtx))

        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        const baseAppend = typeof profile.appendPrompt === 'string' ? profile.appendPrompt : null
        const effectiveAppend = inline.length > 0 ? inline : baseAppend
        const prompt = buildPrSummaryPrompt(input, effectiveAppend ?? undefined)
        const turn = await thread.run(prompt, {signal: summaryCtx.signal})
        const markdown = (turn.finalResponse || '').trim()
        const fallbackTitle = `PR from ${input.headBranch} into ${input.baseBranch}`
        const fallbackBody = `Changes from ${input.baseBranch} to ${input.headBranch} in ${input.repositoryPath}`
        if (!markdown) {
            return {title: fallbackTitle, body: fallbackBody}
        }
        const split = splitTicketMarkdown(markdown, fallbackTitle, fallbackBody)
        return {title: split.title, body: split.description}
    }
}

export const CodexAgent = new CodexImpl()
