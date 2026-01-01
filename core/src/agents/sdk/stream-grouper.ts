import type {AgentContext} from '../types'
import type {ConversationItem, ConversationToolInvocation} from 'shared'

const nowIso = () => new Date().toISOString()

type ExecState = {
    cmd: string
    cwd?: string
    started: number
    stdout: string[]
    stderr: string[]
}

type McpState = {
    server: string
    tool: string
    args?: unknown
    started: number
}

// Aggregates streamed reasoning/tool events into conversation items.
export class StreamGrouper {
    constructor(private options: {emitThinkingImmediately?: boolean} = {}) {}

    private reasoningBuf = ''
    private execPending = new Map<string, ExecState>()
    private lastExecKey: string | null = null
    private mcpPending = new Map<string, McpState>()

    appendReasoning(ctx: AgentContext, text: string) {
        if (!this.options.emitThinkingImmediately) {
            this.reasoningBuf += text
            return
        }

        if (!text.length) return
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'thinking',
                timestamp: nowIso(),
                text,
                format: 'markdown',
            },
        })
    }

    flushReasoning(ctx: AgentContext) {
        if (!this.reasoningBuf.trim().length) {
            this.reasoningBuf = ''
            return
        }
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'thinking',
                timestamp: nowIso(),
                text: this.reasoningBuf.trim(),
                format: 'markdown',
            },
        })
        this.reasoningBuf = ''
    }

    /** Clears buffered reasoning without emitting. */
    clearReasoning() {
        this.reasoningBuf = ''
    }

    execBegin(key: string, info: { cmd: string; cwd?: string }) {
        this.execPending.set(key, {...info, started: Date.now(), stdout: [], stderr: []});
        this.lastExecKey = key
    }

    execAppend(key: string | null, stream: 'stdout' | 'stderr', chunk: string) {
        const effectiveKey = key ?? this.lastExecKey
        if (!effectiveKey) return
        const state = this.execPending.get(effectiveKey)
        if (!state) return
        if (stream === 'stdout') state.stdout.push(chunk)
        else state.stderr.push(chunk)
    }

    execEnd(key: string | null) {
        if (!key && this.lastExecKey) key = this.lastExecKey
        const info = key ? this.execPending.get(key) : undefined
        if (key) this.execPending.delete(key)
        return info
    }

    genExecKey() {
        return `exec:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
    }

    mcpBegin(key: string, info: { server: string; tool: string; args?: unknown }) {
        this.mcpPending.set(key, {...info, started: Date.now()})
    }

    mcpEnd(key: string | null) {
        const info = key ? this.mcpPending.get(key) : undefined
        if (key) this.mcpPending.delete(key)
        return info
    }

    genMcpKey() {
        return `mcp:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
    }

    flush(ctx: AgentContext) {
        this.flushReasoning(ctx)
    }

    buildExecItem(state: ExecState, extra: Partial<ConversationToolInvocation> & {
        status: ConversationToolInvocation['status']
    }): ConversationItem {
        const completedAt = nowIso()
        const metadata = extra.metadata ?? undefined
        return {
            type: 'tool',
            timestamp: completedAt,
            tool: {
                name: 'command',
                action: 'exec',
                command: state.cmd,
                cwd: state.cwd,
                status: extra.status,
                startedAt: new Date(state.started).toISOString(),
                completedAt,
                durationMs: Date.now() - state.started,
                stdout: state.stdout.length ? state.stdout.join('') : undefined,
                stderr: state.stderr.length ? state.stderr.join('') : undefined,
                exitCode: extra.exitCode ?? undefined,
                metadata,
            },
        }
    }

    buildMcpItem(state: McpState, info: {
        status: ConversationToolInvocation['status'];
        metadata?: Record<string, unknown>
    }): ConversationItem {
        const completedAt = nowIso()
        return {
            type: 'tool',
            timestamp: completedAt,
            tool: {
                name: state.server ? `${state.server}.${state.tool}` : state.tool,
                action: 'mcp_tool_call',
                status: info.status,
                startedAt: new Date(state.started).toISOString(),
                completedAt,
                durationMs: Date.now() - state.started,
                metadata: {...info.metadata, args: state.args},
            },
        }
    }
}
