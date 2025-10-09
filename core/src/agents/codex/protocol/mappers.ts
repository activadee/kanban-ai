import type {AgentContext} from "../../types"
import type {CodexEnvelope} from "./types"
import type {
    ConversationItem,
    ConversationMessageItem,
    ConversationToolStatus,
} from 'shared'
import {CodexGrouper} from "../runtime/groupers"

const nowIso = () => new Date().toISOString()

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
    const v = obj[key]
    return typeof v === 'string' ? v : undefined
}

function getPayload(obj: unknown): Record<string, unknown> | undefined {
    if (!isRecord(obj)) return undefined
    const p = obj['payload']
    return isRecord(p) ? p : undefined
}

function emitMessage(
    ctx: AgentContext,
    patch: Omit<ConversationMessageItem, 'timestamp' | 'type'>
) {
    const item: ConversationItem = {
        type: 'message',
        timestamp: nowIso(),
        role: patch.role,
        text: patch.text,
        format: patch.format,
        profileId: patch.profileId ?? null,
    }
    ctx.emit({type: 'conversation', item})
}

function mapRole(role: string): ConversationMessageItem['role'] {
    switch (role) {
        case 'system':
            return 'system'
        case 'user':
            return 'user'
        default:
            return 'assistant'
    }
}

export function handleCodexEnvelope(
    obj: unknown,
    ctx: AgentContext,
    g: CodexGrouper
) {
    try {
        if (!obj || typeof obj !== 'object') return

        if (isRecord(obj)) {
            const topType = getString(obj, 'type')
            if (topType) {
                switch (topType) {
                    case 'session_meta': {
                        const payload = getPayload(obj)
                        const id = payload ? getString(payload, 'id') : undefined
                        if (id) {
                            ctx.emit({type: 'log', level: 'info', message: `[codex:session] id=${id}`})
                            ctx.emit({type: 'session', id})
                        }
                        return
                    }
                    case 'response_item': {
                        const payload = getPayload(obj)
                        if (payload && getString(payload, 'type') === 'message') {
                            const rawRole = getString(payload, 'role') ?? 'assistant'
                            let text = ''
                            const content = payload['content']
                            if (Array.isArray(content)) {
                                const parts = content
                                    .map((p) => (isRecord(p) && typeof p.text === 'string')
                                        ? p.text
                                        : (isRecord(p) && getString(p, 'type') === 'input_text')
                                            ? String(p['text'] ?? '')
                                            : '')
                                    .filter(Boolean)
                                text = parts.join('\n')
                            } else if (typeof payload['text'] === 'string') {
                                text = payload['text'] as string
                            }
                            if (text) {
                                g.flushReasoning(ctx)
                                emitMessage(ctx, {role: mapRole(rawRole), text, format: 'markdown'})
                            }
                        }
                        return
                    }
                    case 'event_msg': {
                        const pm = getPayload(obj)
                        if (pm) {
                            const name = getString(pm, 'type')
                            if (name?.startsWith('agent_reasoning')) {
                                const text = getString(pm, 'text') ?? ''
                                if (text) g.appendReasoning(text)
                            }
                        }
                        return
                    }
                }
            }
        }

        if (isRecord(obj) && isRecord(obj.msg)) {
            const msgObj = obj.msg as Record<string, unknown>
            const t = getString(msgObj, 'type') ?? ''
            switch (t) {
                case 'agent_message': {
                    const text = getString(msgObj, 'message') ?? ''
                    if (text) {
                        g.flushReasoning(ctx)
                        emitMessage(ctx, {role: 'assistant', text})
                    }
                    break
                }
                case 'session_meta': {
                    const id = getString(msgObj, 'session_id') ?? getString(msgObj, 'id')
                    if (id) {
                        ctx.emit({type: 'log', level: 'info', message: `[codex:session] id=${id}`})
                        ctx.emit({type: 'session', id})
                    }
                    break
                }
                case 'agent_reasoning': {
                    const text = getString(msgObj, 'text') ?? ''
                    if (text) g.appendReasoning(text)
                    break
                }
                case 'agent_reasoning_section_break': {
                    g.flushReasoning(ctx)
                    break
                }
                case 'agent_reasoning_section_title': {
                    const title = getString(msgObj, 'title') ?? getString(msgObj, 'text') ?? ''
                    if (title) {
                        g.flushReasoning(ctx)
                        g.appendReasoning(`# ${title}\n`)
                    }
                    break
                }
                case 'agent_reasoning_summary': {
                    const summary = getString(msgObj, 'text') ?? getString(msgObj, 'summary') ?? ''
                    if (summary) {
                        g.flushReasoning(ctx)
                        emitMessage(ctx, {role: 'assistant', text: summary, format: 'markdown'})
                    }
                    break
                }
                case 'agent_reasoning_raw_content':
                case 'agent_reasoning_raw_content_delta': {
                    const text = getString(msgObj, 'text') ?? getString(msgObj, 'delta') ?? ''
                    if (text) g.appendReasoning(text)
                    break
                }
                case 'exec_command_begin': {
                    let cmd = ''
                    const rawCmd = msgObj['command']
                    if (Array.isArray(rawCmd)) cmd = rawCmd.map(String).join(' ')
                    else if (typeof rawCmd === 'string') cmd = rawCmd
                    const key = getString(msgObj, 'call_id') ?? g.genExecKey()
                    const cwd = getString(msgObj, 'cwd')
                    g.flushReasoning(ctx)
                    g.execBegin(key, {cmd, cwd: cwd ?? undefined})
                    break
                }
                case 'exec_command_output_delta': {
                    const streamName = getString(msgObj, 'stream') || 'stdout'
                    const chunk = msgObj['chunk'] as unknown
                    let text = ''
                    if (typeof chunk === 'string') text = chunk
                    else if (typeof chunk === 'number') text = String(chunk)
                    else if (isRecord(chunk) && 'Text' in chunk && typeof chunk['Text'] !== 'undefined')
                        text = String(chunk['Text'])
                    if (text) {
                        g.execAppend(getString(msgObj, 'call_id') ?? null, streamName === 'stderr' ? 'stderr' : 'stdout', text)
                    }
                    break
                }
                case 'exec_command_end': {
                    const key = getString(msgObj, 'call_id') ?? null
                    const info = g.execEnd(key)
                    if (info) {
                        const successVal = msgObj['success']
                        const codeVal = msgObj['exit_code']
                        const success = typeof successVal === 'boolean' ? successVal : undefined
                        const code = typeof codeVal === 'number' ? codeVal : undefined
                        let status: ConversationToolStatus = 'succeeded'
                        if (success === false) status = 'failed'
                        else if (success === true) status = 'succeeded'
                        else if (typeof code === 'number' && code !== 0) status = 'failed'
                        ctx.emit({
                            type: 'conversation',
                            item: g.buildExecItem(info, {
                                status,
                                exitCode: code,
                                metadata: {
                                    success,
                                    stdout: getString(msgObj, 'stdout'),
                                    stderr: getString(msgObj, 'stderr'),
                                },
                            }),
                        })
                    }
                    break
                }
                case 'mcp_tool_call_begin': {
                    const inv = isRecord(msgObj['invocation']) ? (msgObj['invocation'] as Record<string, unknown>) : {}
                    const key = getString(msgObj, 'call_id') ?? g.genMcpKey()
                    g.flushReasoning(ctx)
                    g.mcpBegin(key, {
                        server: getString(inv, 'server') ?? '',
                        tool: getString(inv, 'tool') ?? '',
                        args: inv['arguments'],
                    })
                    break
                }
                case 'mcp_tool_call_end': {
                    const inv = isRecord(msgObj['invocation']) ? (msgObj['invocation'] as Record<string, unknown>) : {}
                    const info = g.mcpEnd(getString(msgObj, 'call_id') ?? null)
                    if (info) {
                        ctx.emit({
                            type: 'conversation',
                            item: g.buildMcpItem(info, {
                                status: 'succeeded',
                                metadata: {invocation: inv},
                            }),
                        })
                    }
                    break
                }
                case 'error': {
                    const text = getString(msgObj, 'message') ?? 'Unknown error'
                    ctx.emit({
                        type: 'conversation',
                        item: {
                            type: 'error',
                            timestamp: nowIso(),
                            text,
                        },
                    })
                    break
                }
                case 'task_started': {
                    break
                }
                case 'task_complete': {
                    const last = obj.msg.last_agent_message ?? ''
                    if (last) {
                        g.flushReasoning(ctx)
                        emitMessage(ctx, {role: 'assistant', text: String(last), format: 'markdown'})
                    }
                    break
                }
                case 'token_count': {
                    break
                }
                default: {
                    ctx.emit({type: 'log', level: 'info', message: `[codex] unhandled envelope type ${t}`})
                }
            }
            return
        }

        if (isRecord(obj) && typeof obj['prompt'] === 'string') {
            emitMessage(ctx, {role: 'user', text: String(obj['prompt'])})
            return
        }
    } catch {
        /* ignore */
    }
}
