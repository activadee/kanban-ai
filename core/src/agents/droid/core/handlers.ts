/**
 * Droid event handlers.
 */
import type {
    StreamEvent,
    isMessageEvent,
    isToolCallEvent,
    isToolResultEvent,
    isTurnCompletedEvent,
    isTurnFailedEvent,
    isSystemInitEvent,
} from '@activade/droid-sdk'
import type {AgentContext} from '../../types'
import type {StreamGrouper} from '../../sdk/stream-grouper'
import type {DroidProfile} from '../profiles/schema'

const nowIso = () => new Date().toISOString()

export type ToolCallInfo = {
    name: string
    startedAt: number
    command?: string
    cwd?: string
}

export function handleSystemInitEvent(
    ev: {session_id: string},
    ctx: AgentContext,
): void {
    ctx.emit({type: 'log', level: 'info', message: `[droid] session ${ev.session_id}`})
    ctx.emit({type: 'session', id: ev.session_id})
}

export function handleMessageEvent(
    ev: {role: string; text?: string; timestamp: number},
    ctx: AgentContext,
    grouper: StreamGrouper,
): void {
    grouper.flushReasoning(ctx)
    if (ev.role === 'assistant' && ev.text) {
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'message',
                timestamp: new Date(ev.timestamp).toISOString(),
                role: 'assistant',
                text: ev.text,
                format: 'markdown',
                profileId: ctx.profileId ?? null,
            },
        })
    }
}

export function handleToolCallEvent(
    ev: {id: string; toolName: string; timestamp: number; parameters?: unknown},
    grouper: StreamGrouper,
    toolCalls: Map<string, ToolCallInfo>,
): void {
    grouper.clearReasoning()
    const params = ev.parameters as Record<string, unknown>
    toolCalls.set(ev.id, {
        name: ev.toolName,
        startedAt: ev.timestamp,
        command: typeof params?.command === 'string' ? params.command : undefined,
        cwd: typeof params?.cwd === 'string' ? params.cwd : undefined,
    })
}

export function handleToolResultEvent(
    ev: {toolId?: string; id: string; toolName: string; timestamp: number; isError: boolean; value?: string},
    ctx: AgentContext,
    toolCalls: Map<string, ToolCallInfo>,
): void {
    const call = toolCalls.get(ev.toolId ?? '') ?? toolCalls.get(ev.id)
    toolCalls.delete(ev.toolId ?? '')
    toolCalls.delete(ev.id)

    const startedAt = call?.startedAt ?? ev.timestamp
    const completedAt = ev.timestamp
    const durationMs = completedAt - startedAt

    ctx.emit({
        type: 'conversation',
        item: {
            type: 'tool',
            timestamp: new Date(ev.timestamp).toISOString(),
            tool: {
                name: call?.name ?? ev.toolName,
                command: call?.command ?? null,
                cwd: call?.cwd ?? null,
                status: ev.isError ? 'failed' : 'succeeded',
                startedAt: new Date(startedAt).toISOString(),
                completedAt: new Date(completedAt).toISOString(),
                durationMs,
                exitCode: null,
                stdout: ev.isError ? null : (ev.value ?? null),
                stderr: ev.isError ? (ev.value ?? null) : null,
                metadata: undefined,
            },
        },
    })
}

export function handleTurnCompletedEvent(
    ev: {durationMs: number},
    ctx: AgentContext,
): void {
    ctx.emit({type: 'log', level: 'info', message: `[droid] completed in ${ev.durationMs}ms`})
}

export function handleTurnFailedEvent(
    ev: {timestamp: number; error: {message: string}},
    ctx: AgentContext,
): void {
    ctx.emit({
        type: 'conversation',
        item: {
            type: 'error',
            timestamp: new Date(ev.timestamp).toISOString(),
            text: ev.error.message,
        },
    })
}

export function handleEvent(
    event: unknown,
    ctx: AgentContext,
    profile: DroidProfile,
    grouper: StreamGrouper,
    toolCalls: Map<string, ToolCallInfo>,
    isSystemInitEventFn: typeof isSystemInitEvent,
    isMessageEventFn: typeof isMessageEvent,
    isToolCallEventFn: typeof isToolCallEvent,
    isToolResultEventFn: typeof isToolResultEvent,
    isTurnCompletedEventFn: typeof isTurnCompletedEvent,
    isTurnFailedEventFn: typeof isTurnFailedEvent,
): void {
    if (!event || typeof event !== 'object') return
    const ev = event as StreamEvent

    if (isSystemInitEventFn(ev)) {
        handleSystemInitEvent(ev, ctx)
        return
    }

    if (isMessageEventFn(ev)) {
        handleMessageEvent(ev, ctx, grouper)
        return
    }

    if (isToolCallEventFn(ev)) {
        handleToolCallEvent(ev, grouper, toolCalls)
        return
    }

    if (isToolResultEventFn(ev)) {
        handleToolResultEvent(ev, ctx, toolCalls)
        return
    }

    if (isTurnCompletedEventFn(ev)) {
        handleTurnCompletedEvent(ev, ctx)
        return
    }

    if (isTurnFailedEventFn(ev)) {
        handleTurnFailedEvent(ev, ctx)
        return
    }

    const eventType = (ev as {type?: string}).type
    if (eventType) {
        ctx.emit({type: 'log', level: 'info', message: `[droid] unhandled event: ${eventType}`})
    }
}
