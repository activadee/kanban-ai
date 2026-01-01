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
    AgentContext,
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import {SdkAgent, type SdkSession} from '../../sdk'
import type {DroidProfile} from '../profiles/schema'
import {DroidProfileSchema, defaultProfile} from '../profiles/schema'
import {StreamGrouper} from '../../sdk/stream-grouper'
import {locateExecutable} from '../../sdk/executable'
import {createEnhanceContext, createPrSummaryContext} from '../../sdk/context-factory'
import {getEffectiveInlinePrompt} from '../../profiles/base'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown, saveImagesToTempFiles, cleanupTempImageFiles} from '../../utils'
import {
    handleEvent as handleEventImpl,
    type ToolCallInfo,
} from './handlers'

type ImageAttachment = {path: string; type: 'image'}

type DroidInstallation = {executablePath: string}
const nowIso = () => new Date().toISOString()

class DroidImpl extends SdkAgent<DroidProfile, DroidInstallation> {
    key = 'DROID' as const
    label = 'Droid Agent'
    defaultProfile = defaultProfile
    profileSchema = DroidProfileSchema
    capabilities = {resume: true}

    private groupers = new Map<string, StreamGrouper>()
    private toolCalls = new Map<string, ToolCallInfo>()

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

    protected async detectInstallation(profile: DroidProfile, ctx: AgentContext): Promise<DroidInstallation> {
        const executablePath = await locateExecutable('droid', {
            envVars: ['DROID_PATH_OVERRIDE', 'DROID_PATH'],
            profileOverride: profile.baseCommandOverride,
        })
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

    protected handleEvent(event: unknown, ctx: AgentContext, profile: DroidProfile): void {
        const grouper = this.getGrouper(ctx.attemptId)
        handleEventImpl(
            event,
            ctx,
            profile,
            grouper,
            this.toolCalls,
            isSystemInitEvent,
            isMessageEvent,
            isToolCallEvent,
            isToolResultEvent,
            isTurnCompletedEvent,
            isTurnFailedEvent,
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle hooks
    // ─────────────────────────────────────────────────────────────────────────

    protected onRunStart(ctx: AgentContext, profile: DroidProfile, mode: 'run' | 'resume'): void {
        this.groupers.set(ctx.attemptId, new StreamGrouper({emitThinkingImmediately: false}))
        const hasImages = ctx.images && ctx.images.length > 0

        if (mode === 'run') {
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
        } else {
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
        }
    }

    protected onRunEnd(ctx: AgentContext, _profile: DroidProfile, _mode: 'run' | 'resume'): void {
        this.groupers.get(ctx.attemptId)?.flush(ctx)
        this.groupers.delete(ctx.attemptId)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inline task implementations (used by SdkAgent.inline())
    // ─────────────────────────────────────────────────────────────────────────

    async enhance(input: TicketEnhanceInput, profile: DroidProfile): Promise<TicketEnhanceResult> {
        const enhanceCtx = createEnhanceContext(input)
        const installation = await this.detectInstallation(profile, enhanceCtx)
        const client = await this.createClient(profile, enhanceCtx, installation)
        const droid = client as Droid
        const thread = droid.startThread(this.threadOptions(profile, input.repositoryPath))

        const effectiveAppend = getEffectiveInlinePrompt(profile)
        const prompt = buildTicketEnhancePrompt(input, effectiveAppend)
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
        const summaryCtx = createPrSummaryContext(input, signal)
        const installation = await this.detectInstallation(profile, summaryCtx)
        const client = await this.createClient(profile, summaryCtx, installation)
        const droid = client as Droid
        const thread = droid.startThread(this.threadOptions(profile, input.repositoryPath))

        const effectiveAppend = getEffectiveInlinePrompt(profile)
        const prompt = buildPrSummaryPrompt(input, effectiveAppend)
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
