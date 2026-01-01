/**
 * Codex logging and debug utilities.
 */
import type {
    ThreadEvent,
    CommandExecutionItem,
    AgentMessageItem,
    ReasoningItem,
    McpToolCallItem,
    FileChangeItem,
    WebSearchItem,
    TodoListItem,
    ErrorItem,
} from '@openai/codex-sdk'

const normalizeForLog = (value: string) => value.replace(/\s+/g, ' ').trim()

export const redactSecrets = (value: string) => {
    let out = value
    // Common "VAR=secret" patterns.
    out = out.replace(/\b(OPENAI_API_KEY|CODEX_API_KEY|OPENCODE_API_KEY|GITHUB_TOKEN)=\S+/g, '$1=<redacted>')
    // Authorization headers (best-effort).
    out = out.replace(/\bAuthorization\s*:\s*(Bearer|Token)\s+([^\s"']+)/gi, (_m, scheme: string) => {
        return `Authorization: ${scheme} <redacted>`
    })
    out = out.replace(/\bAuthorization\s*:\s*(token)\s+([^\s"']+)/gi, () => {
        return 'Authorization: token <redacted>'
    })
    // GitHub PAT formats (best-effort).
    out = out.replace(/\bgithub_pat_[a-zA-Z0-9_]{10,}\b/g, 'github_pat_<redacted>')
    out = out.replace(/\bgh[pous]_[a-zA-Z0-9_]{10,}\b/g, 'ghp_<redacted>')
    // Common OpenAI-style API keys (best-effort).
    out = out.replace(/\bsk-[a-zA-Z0-9_-]{10,}\b/g, 'sk-<redacted>')
    return out
}

export const previewForLog = (value: string, maxLen: number) => {
    // Avoid O(n) work for very large strings: slice first, then normalize/redact.
    const prefixLen = Math.max(0, maxLen + 64)
    const prefix = value.slice(0, prefixLen)
    const cleaned = redactSecrets(normalizeForLog(prefix))
    const truncated = value.length > maxLen
    if (cleaned.length <= maxLen) return truncated ? cleaned + '...' : cleaned
    return cleaned.slice(0, maxLen) + '...'
}

export const summarizeUnknown = (value: unknown): {kind: string; keys?: string[]; length?: number} => {
    if (value === null) return {kind: 'null'}
    if (value === undefined) return {kind: 'undefined'}
    if (typeof value === 'string') return {kind: 'string', length: value.length}
    if (typeof value === 'number') return {kind: 'number'}
    if (typeof value === 'boolean') return {kind: 'boolean'}
    if (Array.isArray(value)) return {kind: 'array', length: value.length}
    if (typeof value === 'object') return {kind: 'object', keys: Object.keys(value as Record<string, unknown>).slice(0, 12)}
    return {kind: typeof value}
}

export function safeStringify(value: unknown): string {
    try {
        const seen = new WeakSet<object>()
        return JSON.stringify(value, (_key, val) => {
            if (typeof val === 'bigint') return String(val)
            if (typeof val === 'function') return '[Function]'
            if (val && typeof val === 'object') {
                if (seen.has(val)) return '[Circular]'
                seen.add(val)
            }
            return val
        })
    } catch (err) {
        return JSON.stringify({
            event: 'debug.serialize_failed',
            error: String(err),
            payload: summarizeUnknown(value),
        })
    }
}

export function summarizeThreadEvent(ev: ThreadEvent): Record<string, unknown> {
    const base: Record<string, unknown> = {event: ev.type}
    if (ev.type === 'thread.started') {
        return {...base, thread_id: ev.thread_id}
    }
    if (ev.type === 'turn.started') {
        return base
    }
    if (ev.type === 'turn.completed') {
        return {
            ...base,
            usage: {
                input_tokens: ev.usage.input_tokens,
                cached_input_tokens: ev.usage.cached_input_tokens,
                output_tokens: ev.usage.output_tokens,
            },
        }
    }
    if (ev.type === 'turn.failed') {
        return {...base, error: {message: ev.error.message}}
    }
    if (ev.type === 'error') {
        return {...base, error: {message: ev.message}}
    }

    if (ev.type === 'item.started' || ev.type === 'item.updated' || ev.type === 'item.completed') {
        const item = ev.item
        const baseItem: Record<string, unknown> = {id: item.id, type: item.type}
        const common: Record<string, unknown> = {
            ...base,
            item: baseItem,
        }

        switch (item.type) {
            case 'agent_message':
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        text_len: (item as AgentMessageItem).text.length,
                        text_preview: previewForLog((item as AgentMessageItem).text, 120),
                    },
                }
            case 'reasoning':
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        text_len: (item as ReasoningItem).text.length,
                    },
                }
            case 'command_execution': {
                const cmdItem = item as CommandExecutionItem
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        status: cmdItem.status,
                        exit_code: cmdItem.exit_code ?? null,
                        command_preview: previewForLog(cmdItem.command, 200),
                        aggregated_output_len: (cmdItem.aggregated_output ?? '').length,
                    },
                }
            }
            case 'mcp_tool_call': {
                const mcpItem = item as McpToolCallItem
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        status: mcpItem.status,
                        server: mcpItem.server,
                        tool: mcpItem.tool,
                        arguments: summarizeUnknown(mcpItem.arguments),
                        result: mcpItem.result
                            ? {
                                  content_len: Array.isArray(mcpItem.result.content) ? mcpItem.result.content.length : 0,
                                  structured_content: summarizeUnknown(mcpItem.result.structured_content),
                              }
                            : null,
                        error: mcpItem.error ? {message: previewForLog(mcpItem.error.message, 200)} : null,
                    },
                }
            }
            case 'file_change': {
                const fileItem = item as FileChangeItem
                const max = 20
                const changes = (fileItem.changes ?? []).slice(0, max).map((c) => ({path: c.path, kind: c.kind}))
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        status: fileItem.status,
                        changes_count: (fileItem.changes ?? []).length,
                        changes,
                        changes_truncated: (fileItem.changes ?? []).length > max,
                    },
                }
            }
            case 'web_search': {
                const webItem = item as WebSearchItem
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        query_len: webItem.query.length,
                        query_preview: previewForLog(webItem.query, 160),
                    },
                }
            }
            case 'todo_list': {
                const todoItem = item as TodoListItem
                const items = todoItem.items ?? []
                const completed = items.filter((t) => Boolean((t as {completed?: unknown}).completed)).length
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        items_total: items.length,
                        items_completed: completed,
                    },
                }
            }
            case 'error': {
                const errItem = item as ErrorItem
                return {
                    ...common,
                    item: {
                        ...baseItem,
                        message_len: errItem.message.length,
                        message_preview: previewForLog(errItem.message, 200),
                    },
                }
            }
            default:
                return common
        }
    }

    return base
}
