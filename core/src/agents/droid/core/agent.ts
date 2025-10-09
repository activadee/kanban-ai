import {z} from 'zod'
import {CommandAgent, type CommandSpec} from '../../command'
import type {Agent, AgentContext} from '../../types'
import {DroidProfileSchema, defaultProfile, type DroidProfile} from '../profiles/schema'
import {buildDroidCommand, buildDroidFollowupCommand} from '../profiles/build'

class DroidImpl extends CommandAgent<z.infer<typeof DroidProfileSchema>> implements Agent<z.infer<typeof DroidProfileSchema>> {
    key = 'DROID' as const
    label = 'Droid Agent'
    defaultProfile = defaultProfile
    profileSchema = DroidProfileSchema
    capabilities = {resume: true}

    private buffers = new Map<string, string>()
    private modes = new Map<string, 'json' | 'debug' | 'ping'>()
    private lastSession = new Map<string, string>()
    private toolQueues = new Map<string, Array<{
        name: string;
        command?: string | null;
        cwd?: string | null;
        startedAt: number
    }>>()

    protected buildCommand(profile: DroidProfile, ctx: AgentContext): CommandSpec {
        const append = profile.appendPrompt || ''
        const promptParts = [ctx.cardTitle, ctx.cardDescription ?? '', append].filter(Boolean)
        const prompt = promptParts.length > 0 ? `"${promptParts.join('\n\n').replace(/"/g, '\\"')}"` : undefined
        const {base, params, env} = buildDroidCommand(profile, prompt, 'json')
        this.modes.set(ctx.attemptId, 'json')
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
        const mode = this.modes.get(ctx.attemptId)
        if (mode === 'json' || mode === 'ping') {
            const prev = this.buffers.get(ctx.attemptId) || ''
            this.buffers.set(ctx.attemptId, prev + line + '\n')
            return
        }

        // In debug mode, lines may be prefixed with control chars causing JSON.parse to fail upstream.
        // Try to sanitize and parse here; if it works, delegate to onStdoutJson.
        if (mode === 'debug') {
            const cleaned = line.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
            let candidate = cleaned
            if (!candidate.startsWith('{')) {
                const s = candidate.indexOf('{')
                const e = candidate.lastIndexOf('}')
                if (s !== -1 && e !== -1 && e > s) candidate = candidate.slice(s, e + 1)
            }
            try {
                const obj = JSON.parse(candidate)
                this.onStdoutJson(obj, ctx, profile)
                return
            } catch {
                /* fall through to log */
            }
        }

        // Fallback: forward as log
        ctx.emit({type: 'log', level: 'info', message: line})
    }

    protected onStdoutJson(obj: unknown, ctx: AgentContext, _profile: DroidProfile) {
        // Only handle NDJSON frames in debug mode
        if (this.modes.get(ctx.attemptId) !== 'debug') return
        try {
            if (!obj || typeof obj !== 'object') return
            const rec = obj as Record<string, unknown>
            const type = typeof rec.type === 'string' ? (rec.type as string) : ''
            const tsRaw = (rec.timestamp as unknown)
            const tsIso = typeof tsRaw === 'number'
                ? new Date(tsRaw).toISOString()
                : (typeof tsRaw === 'string' && !Number.isNaN(Date.parse(tsRaw))
                    ? new Date(tsRaw).toISOString()
                    : new Date().toISOString())

            switch (type) {
                case 'message': {
                    const role = (typeof rec.role === 'string' ? (rec.role as string) : 'assistant') as 'user' | 'assistant' | 'system'
                    const text = typeof rec.text === 'string' ? (rec.text as string) : ''
                    if (text) {
                        ctx.emit({
                            type: 'conversation',
                            item: {
                                type: 'message',
                                timestamp: tsIso,
                                role: role === 'user' ? 'user' : role === 'system' ? 'system' : 'assistant',
                                text,
                                format: 'markdown'
                            }
                        })
                    }
                    break
                }
                case 'tool_call': {
                    const name = typeof rec.toolName === 'string' ? (rec.toolName as string) : (typeof rec.tool === 'string' ? (rec.tool as string) : 'tool')
                    let command: string | null | undefined
                    let cwd: string | null | undefined
                    const params = rec.parameters as unknown
                    if (params && typeof params === 'object') {
                        const p = params as Record<string, unknown>
                        if (typeof p.command === 'string') command = p.command
                        if (typeof p.cwd === 'string') cwd = p.cwd
                    }
                    const arr = this.toolQueues.get(ctx.attemptId) || []
                    arr.push({name, command: command ?? null, cwd: cwd ?? null, startedAt: Date.now()})
                    this.toolQueues.set(ctx.attemptId, arr)
                    break
                }
                case 'tool_result': {
                    const arr = this.toolQueues.get(ctx.attemptId) || []
                    const call = arr.shift()
                    this.toolQueues.set(ctx.attemptId, arr)
                    const value = rec.value as unknown
                    const isErr = rec['isError'] === true || rec['is_error'] === true
                    const errorText = typeof rec['error'] === 'string' ? (rec['error'] as string) : undefined
                    let stdout: string | null = null
                    if (typeof value === 'string') stdout = value
                    else if (value != null) {
                        try {
                            stdout = JSON.stringify(value)
                        } catch {
                            stdout = String(value)
                        }
                    }
                    if (call) {
                        const completed = Date.now()
                        const startedAtIso = new Date(call.startedAt).toISOString()
                        const completedAtIso = new Date(completed).toISOString()
                        const durationMs = completed - call.startedAt
                        ctx.emit({
                            type: 'conversation',
                            item: {
                                type: 'tool',
                                timestamp: tsIso,
                                tool: {
                                    name: call.name,
                                    command: call.command ?? null,
                                    cwd: call.cwd ?? null,
                                    status: isErr ? 'failed' : 'succeeded',
                                    startedAt: startedAtIso,
                                    completedAt: completedAtIso,
                                    durationMs,
                                    exitCode: null,
                                    stdout: isErr ? null : (stdout ?? null),
                                    stderr: isErr ? (errorText ?? stdout ?? null) : null,
                                    metadata: undefined,
                                },
                            },
                        })
                    } else {
                        ctx.emit({
                            type: 'log',
                            level: 'info',
                            message: '[droid:debug] tool_result without prior tool_call'
                        })
                    }
                    break
                }
                case 'error': {
                    const text = typeof rec['message'] === 'string' ? (rec['message'] as string) : 'Unknown error'
                    ctx.emit({type: 'conversation', item: {type: 'error', timestamp: tsIso, text}})
                    break
                }
                default: {
                    // Unknown frame types are logged for observability
                    const t = type || typeof rec
                    ctx.emit({type: 'log', level: 'info', message: `[droid:debug] frame ${String(t)}`})
                }
            }
        } catch {
            /* ignore */
        }
    }

    protected onStderrText(line: string, ctx: AgentContext) {
        ctx.emit({type: 'log', level: 'warn', message: `[droid:stderr] ${line}`})
    }

    protected afterClose(_code: number, ctx: AgentContext, _profile: DroidProfile) {
        const mode = this.modes.get(ctx.attemptId)
        try {
            if (mode === 'debug') {
                // Cleanup any dangling tool queue
                this.toolQueues.delete(ctx.attemptId)
                this.modes.delete(ctx.attemptId)
                return
            }

            let raw = (this.buffers.get(ctx.attemptId) || '').trim()
            this.buffers.delete(ctx.attemptId)
            if (!raw) return

            const parsed = this.parseJsonEnvelope(raw)
            if (!parsed) return

            if (parsed.sessionId) {
                this.lastSession.set(ctx.attemptId, parsed.sessionId)
                ctx.emit({type: 'session', id: parsed.sessionId})
            }

            if (mode === 'ping') {
                // Suppress conversation items for the ping
                this.modes.delete(ctx.attemptId)
                return
            }

            if (parsed.isError) {
                const msg = parsed.error || parsed.result || 'Droid failed'
                ctx.emit({type: 'conversation', item: {type: 'error', timestamp: new Date().toISOString(), text: msg}})
            } else if (parsed.result) {
                ctx.emit({
                    type: 'conversation',
                    item: {
                        type: 'message',
                        timestamp: new Date().toISOString(),
                        role: 'assistant',
                        text: parsed.result,
                        format: 'markdown'
                    }
                })
            }
            this.modes.delete(ctx.attemptId)
        } catch (e) {
            const raw = (this.buffers.get(ctx.attemptId) || '').trim()
            ctx.emit({type: 'log', level: 'warn', message: `[droid] failed to finalize output: ${String(e)}`})
            if (raw) ctx.emit({
                type: 'log',
                level: 'info',
                message: `[droid] raw output: ${raw.substring(0, 500)}${raw.length > 500 ? '...' : ''}`
            })
        }
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
        this.modes.set(ctx.attemptId, 'ping')
        await this.runWithLine(ctx, profile, pingLine, undefined, pingEnv)

        const sid = this.lastSession.get(ctx.attemptId)
        if (sid) this.lastSession.delete(ctx.attemptId)
        if (!sid) {
            ctx.emit({
                type: 'log',
                level: 'warn',
                message: '[droid] ping did not return a session id; falling back to JSON mode'
            })
            // Fallback single JSON run
            if (realPrompt) this.emitUserMessage(ctx, realPrompt)
            this.modes.set(ctx.attemptId, 'json')
            return super.run(ctx, profile)
        }

        // 2) Debug follow-up with real prompt
        const quotedRealPrompt = realPrompt ? `"${realPrompt.replace(/"/g, '\\"')}"` : undefined
        const {base, params, env} = buildDroidFollowupCommand(profile, sid, quotedRealPrompt, 'debug')
        const line = [base, ...params].join(' ')
        this.modes.set(ctx.attemptId, 'debug')
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
            this.modes.set(ctx.attemptId, 'debug')
            ctx.emit({type: 'log', level: 'info', message: `[droid] resume (debug) with session ${ctx.sessionId}`})
            // Do not emit user message; debug stream will include it
            return this.runWithLine(ctx, profile, line, undefined, env)
        }
        const {base, params, env} = buildDroidFollowupCommand(profile, ctx.sessionId, quotedFollowup, 'json')
        const line = [base, ...params].join(' ')
        if (followupPrompt) this.emitUserMessage(ctx, followupPrompt)
        ctx.emit({type: 'log', level: 'info', message: `[droid] resume with session ${ctx.sessionId}`})
        this.modes.set(ctx.attemptId, 'json')
        return this.runWithLine(ctx, profile, line, undefined, env)
    }

    private emitUserMessage(ctx: AgentContext, text: string) {
        if (!text.trim()) return
        ctx.emit({
            type: 'conversation',
            item: {type: 'message', timestamp: new Date().toISOString(), role: 'user', text, format: 'markdown'}
        })
    }

    private parseJsonEnvelope(rawInput: string): {
        sessionId?: string;
        isError?: boolean;
        result?: string;
        error?: string
    } | null {
        try {
            let raw = rawInput.trim()
            raw = raw.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()
            let jsonStr = raw
            if (!raw.startsWith('{')) {
                const startIdx = raw.indexOf('{')
                const endIdx = raw.lastIndexOf('}')
                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) jsonStr = raw.substring(startIdx, endIdx + 1)
            }
            if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) return null
            const payload = JSON.parse(jsonStr) as Record<string, unknown>
            const sessionAny = (payload.session_id ?? payload.sessionId) as unknown
            const sessionId = typeof sessionAny === 'string' && sessionAny ? sessionAny : undefined
            const isError = payload.is_error === true
            const result = typeof payload.result === 'string' ? (payload.result as string) : undefined
            const error = typeof payload['error'] === 'string' ? (payload['error'] as string) : undefined
            return {sessionId, isError, result, error}
        } catch {
            return null
        }
    }
}

export const DroidAgent = new DroidImpl()
