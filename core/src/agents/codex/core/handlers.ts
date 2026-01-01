/**
 * Codex event handlers.
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
import type {AgentContext} from '../../types'
import type {AttemptTodoSummary} from 'shared'
import type {StreamGrouper} from '../../sdk/stream-grouper'

const nowIso = () => new Date().toISOString()

export function handleAgentMessage(item: AgentMessageItem, ctx: AgentContext, grouper: StreamGrouper): void {
    grouper.flushReasoning(ctx)
    ctx.emit({
        type: 'conversation',
        item: {
            type: 'message',
            timestamp: nowIso(),
            role: 'assistant',
            text: item.text,
            format: 'markdown',
            profileId: ctx.profileId ?? null,
        },
    })
}

export function handleReasoning(item: ReasoningItem, ctx: AgentContext, grouper: StreamGrouper): void {
    grouper.appendReasoning(ctx, item.text)
}

export function handleCommand(
    item: CommandExecutionItem,
    eventType: ThreadEvent['type'],
    ctx: AgentContext,
    grouper: StreamGrouper,
    execOutputs: Map<string, string>,
): void {
    if (eventType === 'item.started') {
        grouper.execBegin(item.id, {cmd: item.command})
        execOutputs.set(item.id, '')
        return
    }
    const prev = execOutputs.get(item.id) ?? ''
    const agg = item.aggregated_output ?? ''
    if (agg && agg.length > prev.length) {
        const delta = agg.slice(prev.length)
        grouper.execAppend(item.id, 'stdout', delta)
        execOutputs.set(item.id, agg)
    }
    if (eventType === 'item.completed') {
        const info = grouper.execEnd(item.id)
        execOutputs.delete(item.id)
        if (info) {
            const status = item.status === 'failed' ? 'failed' : 'succeeded'
            ctx.emit({type: 'conversation', item: grouper.buildExecItem(info, {status, exitCode: item.exit_code})})
        }
    }
}

export function handleMcp(
    item: McpToolCallItem,
    eventType: ThreadEvent['type'],
    ctx: AgentContext,
    grouper: StreamGrouper,
): void {
    if (eventType === 'item.started') {
        grouper.mcpBegin(item.id, {server: item.server, tool: item.tool, args: item.arguments})
        return
    }
    if (eventType === 'item.completed') {
        const info = grouper.mcpEnd(item.id)
        if (info) {
            const status = item.status === 'failed' ? 'failed' : 'succeeded'
            ctx.emit({
                type: 'conversation',
                item: grouper.buildMcpItem(info, {
                    status,
                    metadata: item.result ? {result: item.result} : item.error ? {error: item.error} : undefined,
                }),
            })
        }
    }
}

export function handleFileChange(item: FileChangeItem, ctx: AgentContext, grouper: StreamGrouper): void {
    grouper.flushReasoning(ctx)
    ctx.emit({
        type: 'conversation',
        item: {
            type: 'tool',
            timestamp: nowIso(),
            tool: {
                name: 'file_change',
                action: 'apply_patch',
                status: item.status === 'failed' ? 'failed' : 'succeeded',
                metadata: {changes: item.changes},
            },
        },
    })
}

export function handleWebSearch(item: WebSearchItem, ctx: AgentContext, grouper: StreamGrouper): void {
    grouper.flushReasoning(ctx)
    ctx.emit({
        type: 'conversation',
        item: {
            type: 'tool',
            timestamp: nowIso(),
            tool: {
                name: 'web_search',
                action: 'query',
                status: 'succeeded',
                metadata: {query: item.query},
            },
        },
    })
}

export function handleTodo(item: TodoListItem, ctx: AgentContext, grouper: StreamGrouper): void {
    grouper.flushReasoning(ctx)

    const todos: AttemptTodoSummary = (() => {
        const items = (item.items ?? []).map((t, index) => {
            const text = (t as {text?: string}).text ?? ''
            const completed = Boolean((t as {completed?: boolean}).completed)
            const idSource = (t as {id?: string}).id
            const id =
                typeof idSource === 'string' && idSource.trim().length
                    ? idSource
                    : `todo-${index}`
            return {
                id,
                text,
                status: completed ? 'done' : 'open',
            } as const
        })
        const total = items.length
        const completedCount = items.filter((t) => t.status === 'done').length
        return {
            total,
            completed: completedCount,
            items,
        }
    })()

    ctx.emit({type: 'todo', todos})
}

export function handleError(item: ErrorItem, ctx: AgentContext, grouper: StreamGrouper): void {
    grouper.flushReasoning(ctx)
    ctx.emit({
        type: 'conversation',
        item: {
            type: 'error',
            timestamp: nowIso(),
            text: item.message,
        },
    })
}
