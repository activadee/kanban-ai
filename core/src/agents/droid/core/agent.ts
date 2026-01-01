import {execFile} from 'node:child_process'
import {promises as fs, constants as fsConstants} from 'node:fs'
import {promisify} from 'node:util'

import {
    Droid,
    type StreamEvent,
    type TurnResult,
    isMessageEvent,
    isToolCallEvent,
    isToolResultEvent,
    isTurnCompletedEvent,
    isTurnFailedEvent,
    isSystemInitEvent,
} from '@activade/droid-sdk'
import type {
    Agent,
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
import {SdkAgent, type SdkSession} from '../../sdk'
import type {DroidProfile} from '../profiles/schema'
import {DroidProfileSchema, defaultProfile} from '../profiles/schema'
import {StreamGrouper} from '../../sdk/stream-grouper'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown, saveImagesToTempFiles, cleanupTempImageFiles} from '../../utils'

type ImageAttachment = {path: string; type: 'image'}

type DroidInstallation = {executablePath: string}
const execFileAsync = promisify(execFile)
const nowIso = () => new Date().toISOString()

class DroidImpl extends SdkAgent<DroidProfile, DroidInstallation> implements Agent<DroidProfile> {
    key = 'DROID' as const
    label = 'Droid Agent'
    defaultProfile = defaultProfile
    profileSchema = DroidProfileSchema
    capabilities = {resume: true}

    private groupers = new Map<string, StreamGrouper>()
    private toolCalls = new Map<string, {name: string; startedAt: number; command?: string; cwd?: string}>()

    private debug(profile: DroidProfile, ctx: AgentContext, event: unknown) {
        if (!profile.debug) return
        try {
            const serialized = JSON.stringify(event)
            ctx.emit({type: 'log', level: 'info', message: `[droid:debug] ${serialized}`})
        } catch {
            ctx.emit({type: 'log', level: 'info', message: `[droid:debug] [unserializable event]`})
        }
    }

    private threadOptions(profile: DroidProfile, cwd: string) {
        return {
            cwd,
            model: profile.model,
            autonomyLevel: profile.autonomyLevel,
            reasoningEffort: profile.reasoningEffort,
            useSpec: profile.useSpec,
            specModel: profile.specModel,
            specReasoningEffort: profile.specReasoningEffort,
            enabledTools: profile.enabledTools,
            disabledTools: profile.disabledTools,
            skipPermissionsUnsafe: profile.skipPermissionsUnsafe,
        }
    }

    private async verifyExecutable(path: string): Promise<string> {
        const candidate = path.trim()
        if (!candidate.length) throw new Error('droid executable path is empty')
        const mode = process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK
        try {
            await fs.access(candidate, mode)
            return candidate
        } catch (err) {
            throw new Error(`droid executable not accessible at ${candidate}: ${String(err)}`)
        }
    }

    private async locateExecutable(baseCommandOverride?: string | null): Promise<string> {
        if (baseCommandOverride) return this.verifyExecutable(baseCommandOverride)

        const envPath = process.env.DROID_PATH_OVERRIDE ?? process.env.DROID_PATH
        if (envPath) return this.verifyExecutable(envPath)

        const locator = process.platform === 'win32' ? 'where' : 'which'
        try {
            const {stdout} = await execFileAsync(locator, ['droid'])
            const candidate = stdout
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .at(0)

            if (candidate) return this.verifyExecutable(candidate)
        } catch {
        }

        throw new Error('droid executable not found. Install the Droid CLI and ensure it is on PATH or set DROID_PATH/DROID_PATH_OVERRIDE.')
    }

    protected async detectInstallation(profile: DroidProfile, ctx: AgentContext): Promise<DroidInstallation> {
        const executablePath = await this.locateExecutable(profile.baseCommandOverride)
        ctx.emit({type: 'log', level: 'info', message: `[${this.key}] using droid executable: ${executablePath}`})
        return {executablePath}
    }

    protected async createClient(profile: DroidProfile, ctx: AgentContext, installation: DroidInstallation) {
        return new Droid({
            cwd: ctx.worktreePath,
            model: profile.model,
            autonomyLevel: profile.autonomyLevel,
            reasoningEffort: profile.reasoningEffort,
            droidPath: installation.executablePath,
        })
    }

    protected async startSession(
        client: unknown,
        prompt: string,
        profile: DroidProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        _installation: DroidInstallation,
    ): Promise<SdkSession> {
        const droid = client as Droid
        const thread = droid.startThread(this.threadOptions(profile, ctx.worktreePath))

        const hasImages = ctx.images && ctx.images.length > 0
        let imagePaths: string[] = []
        let attachments: ImageAttachment[] | undefined

        if (hasImages) {
            imagePaths = await saveImagesToTempFiles(ctx.images!, `droid-${ctx.attemptId}`)
            attachments = imagePaths.map((path) => ({path, type: 'image' as const}))
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[droid] including ${imagePaths.length} image(s) in request`,
            })
        }

        const {events, result} = await thread.runStreamed(prompt, {attachments})

        return {
            stream: this.wrapEventsWithResult(events, result, ctx, signal, profile, imagePaths),
            sessionId: thread.id,
        }
    }

    protected async resumeSession(
        client: unknown,
        prompt: string,
        sessionId: string,
        profile: DroidProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        _installation: DroidInstallation,
    ): Promise<SdkSession> {
        const droid = client as Droid
        const thread = droid.resumeThread(sessionId, this.threadOptions(profile, ctx.worktreePath))

        const hasImages = ctx.images && ctx.images.length > 0
        let imagePaths: string[] = []
        let attachments: ImageAttachment[] | undefined

        if (hasImages) {
            imagePaths = await saveImagesToTempFiles(ctx.images!, `droid-${ctx.attemptId}`)
            attachments = imagePaths.map((path) => ({path, type: 'image' as const}))
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[droid] including ${imagePaths.length} image(s) in followup`,
            })
        }

        const {events, result} = await thread.runStreamed(prompt, {attachments})

        return {
            stream: this.wrapEventsWithResult(events, result, ctx, signal, profile, imagePaths),
            sessionId: thread.id ?? sessionId,
        }
    }

    private async *wrapEventsWithResult(
        events: AsyncIterable<StreamEvent>,
        result: Promise<TurnResult>,
        ctx: AgentContext,
        signal: AbortSignal,
        profile: DroidProfile,
        tempImagePaths: string[] = [],
    ): AsyncIterable<unknown> {
        try {
            for await (const event of events) {
                if (signal.aborted) break
                this.debug(profile, ctx, event)
                yield event
            }
        } catch (err) {
            if (!signal.aborted) {
                ctx.emit({type: 'log', level: 'error', message: `[droid] stream error: ${String(err)}`})
            }
        }

        try {
            const turnResult = await result
            if (turnResult.isError) {
                yield {type: 'turn.failed', error: {message: turnResult.finalResponse}}
            }
        } catch (err) {
            if (!signal.aborted) {
                ctx.emit({type: 'log', level: 'error', message: `[droid] result error: ${String(err)}`})
            }
        }

        if (tempImagePaths.length > 0) {
            await cleanupTempImageFiles(tempImagePaths).catch(() => {})
        }
    }

    private getGrouper(id: string) {
        if (!this.groupers.has(id)) this.groupers.set(id, new StreamGrouper({emitThinkingImmediately: false}))
        return this.groupers.get(id) as StreamGrouper
    }

    protected handleEvent(event: unknown, ctx: AgentContext, _profile: DroidProfile): void {
        if (!event || typeof event !== 'object') return
        const ev = event as StreamEvent

        if (isSystemInitEvent(ev)) {
            ctx.emit({type: 'log', level: 'info', message: `[droid] session ${ev.session_id}`})
            ctx.emit({type: 'session', id: ev.session_id})
            return
        }

        if (isMessageEvent(ev)) {
            const g = this.getGrouper(ctx.attemptId)
            g.flushReasoning(ctx)
            if (ev.role === 'assistant' && ev.text) {
                ctx.emit({
                    type: 'conversation',
                    item: {
                        type: 'message',
                        timestamp: new Date(ev.timestamp).toISOString(),
                        role: 'assistant',
                        text: ev.text,
                        format: 'markdown',
                        profileId: ctx.profileId ?? null,
                    },
                })
            }
            return
        }

        if (isToolCallEvent(ev)) {
            const g = this.getGrouper(ctx.attemptId)
            g.flushReasoning(ctx)

            const params = ev.parameters as Record<string, unknown>
            this.toolCalls.set(ev.id, {
                name: ev.toolName,
                startedAt: ev.timestamp,
                command: typeof params?.command === 'string' ? params.command : undefined,
                cwd: typeof params?.cwd === 'string' ? params.cwd : undefined,
            })
            return
        }

        if (isToolResultEvent(ev)) {
            const g = this.getGrouper(ctx.attemptId)
            const call = this.toolCalls.get(ev.toolId) ?? this.toolCalls.get(ev.id)
            this.toolCalls.delete(ev.toolId)
            this.toolCalls.delete(ev.id)

            const startedAt = call?.startedAt ?? ev.timestamp
            const completedAt = ev.timestamp
            const durationMs = completedAt - startedAt

            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'tool',
                    timestamp: new Date(ev.timestamp).toISOString(),
                    tool: {
                        name: call?.name ?? ev.toolName,
                        command: call?.command ?? null,
                        cwd: call?.cwd ?? null,
                        status: ev.isError ? 'failed' : 'succeeded',
                        startedAt: new Date(startedAt).toISOString(),
                        completedAt: new Date(completedAt).toISOString(),
                        durationMs,
                        exitCode: null,
                        stdout: ev.isError ? null : (ev.value ?? null),
                        stderr: ev.isError ? (ev.value ?? null) : null,
                        metadata: undefined,
                    },
                },
            })
            return
        }

        if (isTurnCompletedEvent(ev)) {
            ctx.emit({type: 'log', level: 'info', message: `[droid] completed in ${ev.durationMs}ms`})
            return
        }

        if (isTurnFailedEvent(ev)) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'error',
                    timestamp: new Date(ev.timestamp).toISOString(),
                    text: ev.error.message,
                },
            })
            return
        }

        const eventType = (ev as {type?: string}).type
        if (eventType) {
            ctx.emit({type: 'log', level: 'info', message: `[droid] unhandled event: ${eventType}`})
        }
    }

    async run(ctx: AgentContext, profile: DroidProfile): Promise<number> {
        this.groupers.set(ctx.attemptId, new StreamGrouper({emitThinkingImmediately: false}))

        const hasImages = ctx.images && ctx.images.length > 0

        const prompt = this.buildPrompt(profile, ctx)
        if (prompt || hasImages) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'user',
                    text: prompt || '(image attached)',
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                    images: hasImages ? ctx.images : undefined,
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

    async resume(ctx: AgentContext, profile: DroidProfile): Promise<number> {
        if (!ctx.sessionId) throw new Error('Droid resume requires sessionId')
        this.groupers.set(ctx.attemptId, new StreamGrouper({emitThinkingImmediately: false}))

        const hasImages = ctx.images && ctx.images.length > 0

        const prompt = (ctx.followupPrompt ?? '').trim()
        if (prompt.length || hasImages) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'user',
                    text: prompt || '(image attached)',
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                    images: hasImages ? ctx.images : undefined,
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
        profile: DroidProfile,
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
        throw new Error(`Droid inline kind ${kind} is not implemented`)
    }

    async enhance(input: TicketEnhanceInput, profile: DroidProfile): Promise<TicketEnhanceResult> {
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
        const droid = client as Droid
        const thread = droid.startThread(this.threadOptions(profile, input.repositoryPath))

        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        const baseAppend = typeof profile.appendPrompt === 'string' ? profile.appendPrompt : null
        const effectiveAppend = inline.length > 0 ? inline : baseAppend
        const prompt = buildTicketEnhancePrompt(input, effectiveAppend ?? undefined)

        const turn = await thread.run(prompt)
        const markdown = (turn.finalResponse || '').trim()
        if (!markdown) {
            return {title: input.title, description: input.description}
        }
        return splitTicketMarkdown(markdown, input.title, input.description)
    }

    async summarizePullRequest(
        input: PrSummaryInlineInput,
        profile: DroidProfile,
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
        const droid = client as Droid
        const thread = droid.startThread(this.threadOptions(profile, input.repositoryPath))

        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        const baseAppend = typeof profile.appendPrompt === 'string' ? profile.appendPrompt : null
        const effectiveAppend = inline.length > 0 ? inline : baseAppend
        const prompt = buildPrSummaryPrompt(input, effectiveAppend ?? undefined)

        const turn = await thread.run(prompt)
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

export const DroidAgent = new DroidImpl()
