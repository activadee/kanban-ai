import type {z} from 'zod'
import type {Agent, AgentContext} from './types'

export type SdkSession = {
    stream: AsyncIterable<unknown>
    sessionId?: string
}

// Base class for SDK-backed agents (no local child processes).
export abstract class SdkAgent<P> implements Agent<P> {
    abstract key: string
    abstract label: string
    abstract defaultProfile: P
    abstract profileSchema: z.ZodType<P>
    capabilities?: Agent['capabilities']
    availability?: Agent['availability']

    protected abstract createClient(profile: P, ctx: AgentContext): Promise<unknown> | unknown
    protected abstract startSession(
        client: unknown,
        prompt: string,
        profile: P,
        ctx: AgentContext,
        signal: AbortSignal,
    ): Promise<SdkSession>
    protected abstract resumeSession(
        client: unknown,
        prompt: string,
        sessionId: string,
        profile: P,
        ctx: AgentContext,
        signal: AbortSignal,
    ): Promise<SdkSession>
    protected abstract handleEvent(event: unknown, ctx: AgentContext, profile: P): void

    protected buildPrompt(profile: P, ctx: AgentContext): string {
        const append = (profile as Record<string, unknown>)?.appendPrompt
        const extra = typeof append === 'string' ? append : ''
        return [ctx.cardTitle, ctx.cardDescription ?? '', extra]
            .filter(Boolean)
            .join('\n\n')
            .trim()
    }

    private wireAbort(ctx: AgentContext): AbortController {
        const controller = new AbortController()
        const onAbort = () => controller.abort('ctx aborted')
        if (ctx.signal.aborted) onAbort()
        else ctx.signal.addEventListener('abort', onAbort, {once: true})
        return controller
    }

    private async runStream(
        sess: SdkSession,
        ctx: AgentContext,
        profile: P,
    ): Promise<void> {
        for await (const event of sess.stream) {
            this.handleEvent(event, ctx, profile)
        }
    }

    async run(ctx: AgentContext, profile: P): Promise<number> {
        ctx.emit({type: 'status', status: 'running'})
        ctx.emit({type: 'log', level: 'info', message: `[${this.key}] start`})
        const controller = this.wireAbort(ctx)
        try {
            const prompt = this.buildPrompt(profile, ctx)
            const client = await this.createClient(profile, ctx)
            const sess = await this.startSession(client, prompt, profile, ctx, controller.signal)
            if (sess.sessionId) ctx.emit({type: 'session', id: sess.sessionId})
            await this.runStream(sess, ctx, profile)
            ctx.emit({type: 'status', status: 'completed'})
            return 0
        } catch (err) {
            const aborted = controller.signal.aborted || (err as { name?: string } | null)?.name === 'AbortError'
            ctx.emit({type: 'status', status: aborted ? 'aborted' : 'failed'})
            ctx.emit({type: 'log', level: 'error', message: `[${this.key}] ${aborted ? 'aborted' : 'failed'}: ${String(err)}`})
            return aborted ? 1 : 1
        }
    }

    async resume(ctx: AgentContext, profile: P): Promise<number> {
        if (!ctx.sessionId) throw new Error(`${this.key} resume requires sessionId`)
        ctx.emit({type: 'status', status: 'running'})
        ctx.emit({type: 'log', level: 'info', message: `[${this.key}] resume session ${ctx.sessionId}`})
        const controller = this.wireAbort(ctx)
        try {
            const prompt = ctx.followupPrompt ?? ''
            const client = await this.createClient(profile, ctx)
            const sess = await this.resumeSession(client, prompt, ctx.sessionId, profile, ctx, controller.signal)
            if (sess.sessionId) ctx.emit({type: 'session', id: sess.sessionId})
            await this.runStream(sess, ctx, profile)
            ctx.emit({type: 'status', status: 'completed'})
            return 0
        } catch (err) {
            const aborted = controller.signal.aborted || (err as { name?: string } | null)?.name === 'AbortError'
            ctx.emit({type: 'status', status: aborted ? 'aborted' : 'failed'})
            ctx.emit({type: 'log', level: 'error', message: `[${this.key}] ${aborted ? 'aborted' : 'failed'}: ${String(err)}`})
            return aborted ? 1 : 1
        }
    }
}
