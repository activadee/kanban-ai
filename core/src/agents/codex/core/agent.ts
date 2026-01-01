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
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import {SdkAgent} from '../../sdk'
import type {CodexProfile} from '../profiles/schema'
import {CodexProfileSchema, defaultProfile} from '../profiles/schema'
import {StreamGrouper} from '../../sdk/stream-grouper'
import {locateExecutable} from '../../sdk/executable'
import {createEnhanceContext, createPrSummaryContext} from '../../sdk/context-factory'
import {getEffectiveInlinePrompt} from '../../profiles/base'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown, saveImagesToTempFiles} from '../../utils'
import {safeStringify, summarizeThreadEvent} from './logging'
import {
    handleAgentMessage,
    handleReasoning,
    handleCommand,
    handleMcp,
    handleFileChange,
    handleWebSearch,
    handleTodo,
    handleError,
} from './handlers'

type CodexInstallation = {executablePath: string}
const nowIso = () => new Date().toISOString()

class CodexImpl extends SdkAgent<CodexProfile, CodexInstallation> {
    key = 'CODEX'
    label = 'Codex Agent'
    defaultProfile = defaultProfile
    profileSchema = CodexProfileSchema
    capabilities = {resume: true}

    private groupers = new Map<string, StreamGrouper>()
    private execOutputs = new Map<string, string>()

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
        const serialized = safeStringify(base)
        ctx.emit({type: 'log', level: 'info', message: `[codex:debug] ${serialized}`})
    }

    protected async detectInstallation(_profile: CodexProfile, ctx: AgentContext): Promise<CodexInstallation> {
        const executablePath = await locateExecutable('codex', {
            envVars: ['CODEX_PATH_OVERRIDE', 'CODEX_PATH'],
        })
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

    protected handleEvent(event: unknown, ctx: AgentContext, profile: CodexProfile): void {
        if (!event || typeof event !== 'object' || typeof (event as {type?: unknown}).type !== 'string') return
        const ev = event as ThreadEvent
        this.debug(profile, ctx, () => summarizeThreadEvent(ev))

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
            ctx.emit({type: 'conversation', item: {type: 'error', timestamp: nowIso(), text: ev.error.message}})
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

            const grouper = this.getGrouper(ctx.attemptId)

            switch (item.type) {
                case 'agent_message':
                    handleAgentMessage(item, ctx, grouper)
                    break
                case 'reasoning':
                    handleReasoning(item, ctx, grouper)
                    break
                case 'command_execution':
                    handleCommand(item, ev.type, ctx, grouper, this.execOutputs)
                    break
                case 'mcp_tool_call':
                    handleMcp(item, ev.type, ctx, grouper)
                    break
                case 'file_change':
                    if (ev.type === 'item.completed') handleFileChange(item, ctx, grouper)
                    break
                case 'web_search':
                    if (ev.type === 'item.completed') handleWebSearch(item, ctx, grouper)
                    break
                case 'todo_list':
                    if (ev.type === 'item.completed' || ev.type === 'item.updated') handleTodo(item, ctx, grouper)
                    break
                case 'error':
                    handleError(item, ctx, grouper)
                    break
                default:
                    ctx.emit({type: 'log', level: 'info', message: `[codex] unhandled item ${(item as {type?: string}).type ?? 'unknown'}`})
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle hooks
    // ─────────────────────────────────────────────────────────────────────────

    protected onRunStart(ctx: AgentContext, profile: CodexProfile, mode: 'run' | 'resume'): void {
        this.groupers.set(ctx.attemptId, new StreamGrouper({emitThinkingImmediately: true}))

        if (mode === 'run') {
            const prompt = this.buildPrompt(profile, ctx)
            if (prompt) {
                ctx.emit({
                    type: 'conversation',
                    item: {
                        type: 'message',
                        timestamp: nowIso(),
                        role: 'user',
                        text: prompt,
                        format: 'markdown',
                        profileId: ctx.profileId ?? null,
                    },
                })
            }
        } else {
            const prompt = (ctx.followupPrompt ?? '').trim()
            if (prompt.length || (ctx.images && ctx.images.length > 0)) {
                ctx.emit({
                    type: 'conversation',
                    item: {
                        type: 'message',
                        timestamp: nowIso(),
                        role: 'user',
                        text: prompt || '(image attached)',
                        format: 'markdown',
                        profileId: ctx.profileId ?? null,
                        images: ctx.images,
                    },
                })
            }
        }
    }

    protected onRunEnd(ctx: AgentContext, _profile: CodexProfile, _mode: 'run' | 'resume'): void {
        this.groupers.get(ctx.attemptId)?.flush(ctx)
        this.groupers.delete(ctx.attemptId)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inline task implementations (used by SdkAgent.inline())
    // ─────────────────────────────────────────────────────────────────────────

    async enhance(input: TicketEnhanceInput, profile: CodexProfile): Promise<TicketEnhanceResult> {
        const enhanceCtx = createEnhanceContext(input)
        const installation = await this.detectInstallation(profile, enhanceCtx)
        const client = await this.createClient(profile, enhanceCtx, installation)
        const codex = client as Codex
        const thread = codex.startThread(this.threadOptions(profile, enhanceCtx))

        const effectiveAppend = getEffectiveInlinePrompt(profile)
        const prompt = buildTicketEnhancePrompt(input, effectiveAppend)
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
        const summaryCtx = createPrSummaryContext(input, signal)
        const installation = await this.detectInstallation(profile, summaryCtx)
        const client = await this.createClient(profile, summaryCtx, installation)
        const codex = client as Codex
        const thread = codex.startThread(this.threadOptions(profile, summaryCtx))

        const effectiveAppend = getEffectiveInlinePrompt(profile)
        const prompt = buildPrSummaryPrompt(input, effectiveAppend)
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
