import type {z} from 'zod'
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
} from './types'

export type SdkSession = {
    stream: AsyncIterable<unknown>
    sessionId?: string
}

export type AgentInstallInfo = {
    executablePath?: string
}

/**
 * Base class for SDK-backed agents.
 *
 * Provides common functionality for agents that interact with external SDKs:
 * - Session lifecycle (run/resume)
 * - Abort signal handling
 * - Event stream processing
 * - Default inline task dispatch
 *
 * Subclasses must implement:
 * - detectInstallation: Verify/locate the agent's dependencies
 * - createClient: Create the SDK client instance
 * - startSession/resumeSession: Begin or continue a session
 * - handleEvent: Process events from the SDK stream
 *
 * Optionally override:
 * - enhance: Custom ticket enhancement logic
 * - summarizePullRequest: Custom PR summary logic
 * - onRunStart/onRunEnd: Lifecycle hooks for run/resume
 */
export abstract class SdkAgent<P, I = AgentInstallInfo> implements Agent<P> {
    abstract key: string
    abstract label: string
    abstract defaultProfile: P
    abstract profileSchema: z.ZodType<P>
    capabilities?: Agent['capabilities']
    availability?: Agent['availability']

    // ─────────────────────────────────────────────────────────────────────────
    // Abstract methods - must be implemented by subclasses
    // ─────────────────────────────────────────────────────────────────────────

    protected abstract detectInstallation(profile: P, ctx: AgentContext): Promise<I>

    protected abstract createClient(profile: P, ctx: AgentContext, install: I): Promise<unknown> | unknown

    protected abstract startSession(
        client: unknown,
        prompt: string,
        profile: P,
        ctx: AgentContext,
        signal: AbortSignal,
        install: I,
    ): Promise<SdkSession>

    protected abstract resumeSession(
        client: unknown,
        prompt: string,
        sessionId: string,
        profile: P,
        ctx: AgentContext,
        signal: AbortSignal,
        install: I,
    ): Promise<SdkSession>

    protected abstract handleEvent(event: unknown, ctx: AgentContext, profile: P): void

    // ─────────────────────────────────────────────────────────────────────────
    // Optional lifecycle hooks - can be overridden by subclasses
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Called at the start of run() and resume() before session starts.
     * Use for setup like initializing groupers or emitting initial messages.
     */
    protected onRunStart?(ctx: AgentContext, profile: P, mode: 'run' | 'resume'): void | Promise<void>

    /**
     * Called at the end of run() and resume() after session completes.
     * Always called, even on error. Use for cleanup like flushing groupers.
     */
    protected onRunEnd?(ctx: AgentContext, profile: P, mode: 'run' | 'resume'): void | Promise<void>

    // ─────────────────────────────────────────────────────────────────────────
    // Optional inline task methods - can be overridden by subclasses
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Enhance a ticket with AI-generated improvements.
     * Override this method to provide custom ticket enhancement.
     */
    enhance?(input: TicketEnhanceInput, profile: P): Promise<TicketEnhanceResult>

    /**
     * Generate a pull request summary.
     * Override this method to provide custom PR summary generation.
     */
    summarizePullRequest?(
        input: PrSummaryInlineInput,
        profile: P,
        signal?: AbortSignal,
    ): Promise<PrSummaryInlineResult>

    // ─────────────────────────────────────────────────────────────────────────
    // Built-in implementations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds the prompt from card context and profile settings.
     */
    protected buildPrompt(profile: P, ctx: AgentContext): string {
        const append = (profile as Record<string, unknown>)?.appendPrompt
        const extra = typeof append === 'string' ? append : ''
        return [ctx.cardTitle, ctx.cardDescription ?? '', extra]
            .filter(Boolean)
            .join('\n\n')
            .trim()
    }

    /**
     * Wires up abort signal forwarding.
     */
    private wireAbort(ctx: AgentContext): AbortController {
        const controller = new AbortController()
        const onAbort = () => controller.abort('ctx aborted')
        if (ctx.signal.aborted) onAbort()
        else ctx.signal.addEventListener('abort', onAbort, {once: true})
        return controller
    }

    /**
     * Processes all events from a session stream.
     */
    private async runStream(sess: SdkSession, ctx: AgentContext, profile: P): Promise<void> {
        for await (const event of sess.stream) {
            this.handleEvent(event, ctx, profile)
        }
    }

    /**
     * Default inline task dispatcher.
     * Routes to enhance() or summarizePullRequest() based on task kind.
     * Override this method only if you need completely custom inline behavior.
     */
    async inline<K extends InlineTaskKind>(
        kind: K,
        input: InlineTaskInputByKind[K],
        profile: P,
        opts?: {context: InlineTaskContext; signal?: AbortSignal},
    ): Promise<InlineTaskResultByKind[K]> {
        if (kind === 'ticketEnhance') {
            if (!this.enhance) {
                throw new Error(`${this.key} does not support ticketEnhance`)
            }
            const result = await this.enhance(input as TicketEnhanceInput, profile)
            return result as InlineTaskResultByKind[K]
        }
        if (kind === 'prSummary') {
            if (!this.summarizePullRequest) {
                throw new Error(`${this.key} does not support prSummary`)
            }
            const result = await this.summarizePullRequest(
                input as PrSummaryInlineInput,
                profile,
                opts?.signal,
            )
            return result as InlineTaskResultByKind[K]
        }
        throw new Error(`${this.key} inline kind ${kind} is not implemented`)
    }

    /**
     * Runs a new agent session with the given context and profile.
     */
    async run(ctx: AgentContext, profile: P): Promise<number> {
        ctx.emit({type: 'status', status: 'running'})
        ctx.emit({type: 'log', level: 'info', message: `[${this.key}] start`})
        const controller = this.wireAbort(ctx)
        try {
            await this.onRunStart?.(ctx, profile, 'run')
            const installation = await this.detectInstallation(profile, ctx)
            const prompt = this.buildPrompt(profile, ctx)
            const client = await this.createClient(profile, ctx, installation)
            const sess = await this.startSession(client, prompt, profile, ctx, controller.signal, installation)
            if (sess.sessionId) ctx.emit({type: 'session', id: sess.sessionId})
            await this.runStream(sess, ctx, profile)
            ctx.emit({type: 'status', status: 'completed'})
            return 0
        } catch (err) {
            const aborted = controller.signal.aborted || (err as {name?: string} | null)?.name === 'AbortError'
            ctx.emit({type: 'status', status: aborted ? 'aborted' : 'failed'})
            ctx.emit({
                type: 'log',
                level: 'error',
                message: `[${this.key}] ${aborted ? 'aborted' : 'failed'}: ${String(err)}`,
            })
            return 1
        } finally {
            await this.onRunEnd?.(ctx, profile, 'run')
        }
    }

    /**
     * Resumes an existing agent session.
     */
    async resume(ctx: AgentContext, profile: P): Promise<number> {
        if (!ctx.sessionId) throw new Error(`${this.key} resume requires sessionId`)
        ctx.emit({type: 'status', status: 'running'})
        ctx.emit({type: 'log', level: 'info', message: `[${this.key}] resume session ${ctx.sessionId}`})
        const controller = this.wireAbort(ctx)
        try {
            await this.onRunStart?.(ctx, profile, 'resume')
            const prompt = ctx.followupPrompt ?? ''
            const installation = await this.detectInstallation(profile, ctx)
            const client = await this.createClient(profile, ctx, installation)
            const sess = await this.resumeSession(
                client,
                prompt,
                ctx.sessionId,
                profile,
                ctx,
                controller.signal,
                installation,
            )
            if (sess.sessionId) ctx.emit({type: 'session', id: sess.sessionId})
            await this.runStream(sess, ctx, profile)
            ctx.emit({type: 'status', status: 'completed'})
            return 0
        } catch (err) {
            const aborted = controller.signal.aborted || (err as {name?: string} | null)?.name === 'AbortError'
            ctx.emit({type: 'status', status: aborted ? 'aborted' : 'failed'})
            ctx.emit({
                type: 'log',
                level: 'error',
                message: `[${this.key}] ${aborted ? 'aborted' : 'failed'}: ${String(err)}`,
            })
            return 1
        } finally {
            await this.onRunEnd?.(ctx, profile, 'resume')
        }
    }
}
