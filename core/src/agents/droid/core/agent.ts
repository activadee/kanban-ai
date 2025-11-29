import {z} from 'zod'
import {spawn} from 'child_process'
import {CommandAgent, type CommandSpec} from '../../command'
import type {
    Agent,
    AgentContext,
    InlineTaskContext,
    InlineTaskInputByKind,
    InlineTaskKind,
    InlineTaskResultByKind,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import {buildTicketEnhancePrompt, splitTicketMarkdown} from '../../utils'
import {DroidProfileSchema, defaultProfile, type DroidProfile} from '../profiles/schema'
import {buildDroidCommand, buildDroidFollowupCommand} from '../profiles/build'
import {DroidStreamProcessor} from './parse'

async function runDroidTextCommand(
    line: string,
    cwd: string,
    env: Record<string, string> | undefined,
    signal: AbortSignal,
): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const child = spawn('bash', ['-lc', line], {
            cwd,
            env: {...process.env, ...(env || {})},
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: process.platform !== 'win32',
        })

        let stdout = ''
        let stderr = ''
        let aborted = false

        const onAbort = () => {
            try {
                aborted = true
                if (process.platform !== 'win32' && child.pid) {
                    try {
                        process.kill(-child.pid, 'SIGTERM')
                    } catch {
                        child.kill('SIGTERM')
                    }
                } else {
                    child.kill('SIGTERM')
                }
            } catch {
            }
        }

        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, {once: true})

        child.stdout?.on('data', (chunk) => {
            stdout += String(chunk)
        })
        child.stderr?.on('data', (chunk) => {
            stderr += String(chunk)
        })

        child.on('error', (err) => {
            try {
                signal.removeEventListener('abort', onAbort as unknown as EventListener)
            } catch {
            }
            reject(err)
        })

        child.on('close', (code) => {
            try {
                signal.removeEventListener('abort', onAbort as unknown as EventListener)
            } catch {
            }
            if (aborted || signal.aborted) {
                reject(new Error('Droid enhance aborted'))
                return
            }
            if (code !== 0) {
                const msg = (stderr || stdout || `Droid exited with code ${code}`).toString()
                reject(new Error(msg))
                return
            }
            resolve(stdout.toString())
        })
    })
}

class DroidImpl extends CommandAgent<z.infer<typeof DroidProfileSchema>> implements Agent<z.infer<typeof DroidProfileSchema>> {
    key = 'DROID' as const
    label = 'Droid Agent'
    defaultProfile = defaultProfile
    profileSchema = DroidProfileSchema
    capabilities = {resume: true}

    private stream = new DroidStreamProcessor()

    protected buildCommand(profile: DroidProfile, ctx: AgentContext): CommandSpec {
        const append = profile.appendPrompt || ''
        const promptParts = [ctx.cardTitle, ctx.cardDescription ?? '', append].filter(Boolean)
        const prompt = promptParts.length > 0 ? `"${promptParts.join('\n\n').replace(/"/g, '\\"')}"` : undefined
        const {base, params, env} = buildDroidCommand(profile, prompt, 'json')
        this.stream.setMode(ctx.attemptId, 'json')
        return {line: [base, ...params].join(' '), env}
    }

    protected buildStdin(_profile: DroidProfile, _ctx: AgentContext): string | undefined {
        // Droid uses command-line prompt, not stdin
        return undefined
    }

    protected debugEnabled(profile: DroidProfile) {
        return !!profile.debug
    }

    protected onStdoutText(line: string, ctx: AgentContext, profile: DroidProfile) {
        this.stream.onStdoutText(line, ctx, profile)
    }

    protected onStdoutJson(obj: unknown, ctx: AgentContext, _profile: DroidProfile) {
        this.stream.onStdoutJson(obj, ctx, _profile)
    }

    protected onStderrText(line: string, ctx: AgentContext) {
        this.stream.onStderrText(line, ctx)
    }

    protected afterClose(_code: number, ctx: AgentContext, _profile: DroidProfile) {
        this.stream.afterClose(_code, ctx, _profile)
    }

    async run(ctx: AgentContext, profile: DroidProfile): Promise<number> {
        const append = profile.appendPrompt || ''
        const promptParts = [ctx.cardTitle, ctx.cardDescription ?? '', append].filter(Boolean)
        const realPrompt = promptParts.join('\n\n').trim()

        if (!profile.debug) {
            if (realPrompt) this.emitUserMessage(ctx, realPrompt)
            return super.run(ctx, profile)
        }

        // Hybrid flow: 1) JSON ping to capture session id
        const pingText = 'session ping: respond with "ok" and exit immediately.'
        const pingPrompt = `"${pingText.replace(/"/g, '\\"')}"`
        const {base: pingBase, params: pingParams, env: pingEnv} = buildDroidCommand(profile, pingPrompt, 'json')
        const pingLine = [pingBase, ...pingParams].join(' ')
        this.stream.setMode(ctx.attemptId, 'ping')
        await this.runWithLine(ctx, profile, pingLine, undefined, pingEnv)

        const sid = this.stream.takeLastSession(ctx.attemptId)
        if (!sid) {
            ctx.emit({
                type: 'log',
                level: 'warn',
                message: '[droid] ping did not return a session id; falling back to JSON mode'
            })
            // Fallback single JSON run
            if (realPrompt) this.emitUserMessage(ctx, realPrompt)
            this.stream.setMode(ctx.attemptId, 'json')
            return super.run(ctx, profile)
        }

        // 2) Debug follow-up with real prompt
        const quotedRealPrompt = realPrompt ? `"${realPrompt.replace(/"/g, '\\"')}"` : undefined
        const {base, params, env} = buildDroidFollowupCommand(profile, sid, quotedRealPrompt, 'debug')
        const line = [base, ...params].join(' ')
        this.stream.setMode(ctx.attemptId, 'debug')
        ctx.emit({type: 'log', level: 'info', message: `[droid] continue in debug with session ${sid}`})
        return this.runWithLine(ctx, profile, line, undefined, env)
    }

    async resume(ctx: AgentContext, profile: DroidProfile): Promise<number> {
        if (!ctx.sessionId) throw new Error('Droid resume requires sessionId')
        const followupPrompt = ctx.followupPrompt?.trim()
        const quotedFollowup = followupPrompt ? `"${followupPrompt.replace(/"/g, '\\"')}"` : undefined
        if (profile.debug) {
            const {base, params, env} = buildDroidFollowupCommand(profile, ctx.sessionId, quotedFollowup, 'debug')
            const line = [base, ...params].join(' ')
            this.stream.setMode(ctx.attemptId, 'debug')
            ctx.emit({type: 'log', level: 'info', message: `[droid] resume (debug) with session ${ctx.sessionId}`})
            // Do not emit user message; debug stream will include it
            return this.runWithLine(ctx, profile, line, undefined, env)
        }
        const {base, params, env} = buildDroidFollowupCommand(profile, ctx.sessionId, quotedFollowup, 'json')
        const line = [base, ...params].join(' ')
        if (followupPrompt) this.emitUserMessage(ctx, followupPrompt)
        ctx.emit({type: 'log', level: 'info', message: `[droid] resume with session ${ctx.sessionId}`})
        this.stream.setMode(ctx.attemptId, 'json')
        return this.runWithLine(ctx, profile, line, undefined, env)
    }

    private emitUserMessage(ctx: AgentContext, text: string) {
        if (!text.trim()) return
        ctx.emit({
            type: 'conversation',
            item: {type: 'message', timestamp: new Date().toISOString(), role: 'user', text, format: 'markdown'}
        })
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
        throw new Error(`Droid inline kind ${kind} is not implemented`)
    }

    async enhance(input: TicketEnhanceInput, profile: DroidProfile): Promise<TicketEnhanceResult> {
        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        const baseAppend = typeof profile.appendPrompt === 'string' ? profile.appendPrompt : null
        const effectiveAppend = inline.length > 0 ? inline : baseAppend
        const prompt = buildTicketEnhancePrompt(input, effectiveAppend ?? undefined)
        const quotedPrompt = `"${prompt.replace(/"/g, '\\"')}"`
        const {base, params, env} = buildDroidCommand(profile, quotedPrompt, 'text')
        const line = [base, ...params].join(' ')
        const cwd = input.repositoryPath || process.cwd()
        const raw = await runDroidTextCommand(line, cwd, env, input.signal)
        const markdown = raw.trim()
        if (!markdown) {
            return {title: input.title, description: input.description}
        }
        return splitTicketMarkdown(markdown, input.title, input.description)
    }
}

export const DroidAgent = new DroidImpl()
