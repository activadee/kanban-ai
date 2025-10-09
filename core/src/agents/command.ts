import {spawn} from 'child_process'
import type {Agent, AgentContext} from './types'
import type {z} from 'zod'

export type CommandSpec = {
    line: string
    env?: Record<string, string>
}

export abstract class CommandAgent<P> implements Agent<P> {
    abstract key: string
    abstract label: string
    abstract defaultProfile: P
    abstract profileSchema: z.ZodType<P>

    capabilities?: Agent['capabilities']
    availability?: Agent['availability']

    // Subclasses implement these hooks
    protected abstract buildCommand(profile: P, ctx: AgentContext): CommandSpec

    protected buildStdin(_profile: P, ctx: AgentContext): string | undefined {
        // default: no stdin
        return undefined
    }

    protected onStdoutJson(_obj: unknown, _ctx: AgentContext, _profile: P) {
        // default: ignore
    }

    protected onStdoutText(line: string, ctx: AgentContext, _profile: P) {
        ctx.emit({type: 'log', level: 'info', message: line})
    }

    protected onStderrText(line: string, ctx: AgentContext, _profile: P) {
        ctx.emit({type: 'log', level: 'warn', message: line})
    }

    protected afterClose(_code: number, _ctx: AgentContext, _profile: P) {
        // default: noop
    }

    protected debugEnabled(_profile: P): boolean {
        return false
    }

    protected async runWithLine(
        ctx: AgentContext,
        profile: P,
        line: string,
        stdinOverride?: string,
        envOverride?: Record<string, string>,
    ): Promise<number> {
        const debug = this.debugEnabled(profile)
        const commandForLog = `[${this.key}] command: ${line}`
        try {
            await ctx.emit({type: 'log', level: 'info', message: `[${this.key}] start cwd=${ctx.worktreePath}`})
            await ctx.emit({type: 'log', level: 'info', message: commandForLog})
        } catch {
        }
        ctx.emit({type: 'status', status: 'running'})

        const started = Date.now()
        const child = spawn('bash', ['-lc', line], {
            cwd: ctx.worktreePath,
            env: {...process.env, ...(envOverride || {})},
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: process.platform !== 'win32',
        })

        // Abort handling: on ctx.signal.abort → SIGTERM, then SIGKILL fallback
        let aborted = false
        let killTimer: ReturnType<typeof setTimeout> | null = null
        const onAbort = () => {
            try {
                aborted = true
                ctx.emit({type: 'log', level: 'warn', message: `[${this.key}] abort requested → SIGTERM`})
                // Send SIGTERM first; prefer killing the entire process group when available
                if (process.platform !== 'win32' && child.pid) {
                    try {
                        process.kill(-child.pid, 'SIGTERM')
                    } catch {
                        try {
                            child.kill('SIGTERM')
                        } catch {
                        }
                    }
                } else {
                    try {
                        child.kill('SIGTERM')
                    } catch {
                    }
                }
                // Hard kill after grace period
                killTimer = setTimeout(() => {
                    if (!child.killed) {
                        ctx.emit({type: 'log', level: 'warn', message: `[${this.key}] abort escalation → SIGKILL`})
                        try {
                            if (process.platform !== 'win32' && child.pid) {
                                try {
                                    process.kill(-child.pid, 'SIGKILL')
                                } catch {
                                    try {
                                        child.kill('SIGKILL')
                                    } catch {
                                    }
                                }
                            } else {
                                child.kill('SIGKILL')
                            }
                        } catch {
                        }
                    }
                }, 3000)
            } catch {
            }
        }
        if (ctx.signal.aborted) onAbort()
        else ctx.signal.addEventListener('abort', onAbort, {once: true})

        // stdin
        const input = stdinOverride !== undefined ? stdinOverride : this.buildStdin(profile, ctx)
        if (input !== undefined) {
            try {
                child.stdin?.write(input);
                child.stdin?.end()
            } catch (err) {
                ctx.emit({type: 'log', level: 'error', message: `[${this.key}] failed to write stdin: ${String(err)}`})
            }
        }

        // stdout/stderr line splitting
        const split = (stream: NodeJS.ReadableStream, on: (line: string) => void) => {
            let buf = ''
            stream.on('data', (chunk) => {
                buf += String(chunk)
                let i
                while ((i = buf.indexOf('\n')) !== -1) {
                    const line = buf.slice(0, i);
                    buf = buf.slice(i + 1)
                    if (line.trim().length) on(line)
                }
            })
            stream.on('end', () => {
                if (buf.trim().length) on(buf)
            })
        }

        split(child.stdout, (line) => {
            try {
                const obj = JSON.parse(line);
                this.onStdoutJson(obj, ctx, profile)
            } catch {
                this.onStdoutText(line, ctx, profile)
            }
        })
        split(child.stderr, (line) => this.onStderrText(line, ctx, profile))

        const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 0)))
        // Cleanup abort listener/timer
        try {
            ctx.signal.removeEventListener?.('abort', onAbort as unknown as EventListener)
        } catch {
        }
        if (killTimer) clearTimeout(killTimer)
        const dur = Math.round((Date.now() - started) / 1000)
        if (debug) ctx.emit({type: 'log', level: 'info', message: `[${this.key}] exited code=${code} after ${dur}s`})
        this.afterClose(code, ctx, profile)
        return code
    }

    async run(ctx: AgentContext, profile: P): Promise<number> {
        const spec = this.buildCommand(profile, ctx)
        return this.runWithLine(ctx, profile, spec.line, undefined, spec.env)
    }

    // Agents that extend CommandAgent must implement conversation resume.
    abstract resume(ctx: AgentContext, profile: P): Promise<number>
}
