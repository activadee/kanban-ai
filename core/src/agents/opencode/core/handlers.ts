/**
 * OpenCode event handlers.
 */
import type {
    Event,
    EventMessagePartUpdated,
    EventMessageUpdated,
    EventSessionError,
    EventTodoUpdated,
    ReasoningPart,
    TextPart,
    ToolPart,
    ToolState,
    Todo,
} from '@opencode-ai/sdk'
import type {AgentContext} from '../../types'
import type {AttemptTodoSummary} from 'shared'
import type {OpencodeGrouper} from '../runtime/grouper'
import type {ShareToolContent, ShareToolMetadata, ShareToolInput, ShareToolState} from '../protocol/types'
import type {OpencodeProfile} from '../profiles/schema'

const nowIso = () => new Date().toISOString()

export type SessionEvent = Event

export function extractSessionId(event: SessionEvent): string | undefined {
    const properties = (event as {properties?: unknown}).properties
    if (!properties || typeof properties !== 'object') return undefined
    const props = properties as {sessionID?: unknown; sessionId?: unknown; info?: unknown; part?: unknown}

    const direct = props.sessionID ?? props.sessionId
    if (typeof direct === 'string') return direct

    const info = props.info as {sessionID?: unknown; sessionId?: unknown} | undefined
    const infoId = info?.sessionID ?? info?.sessionId
    if (typeof infoId === 'string') return infoId

    const part = props.part as {sessionID?: unknown; sessionId?: unknown} | undefined
    const partId = part?.sessionID ?? part?.sessionId
    if (typeof partId === 'string') return partId

    return undefined
}

export function mapToolState(state: ToolState): ShareToolState {
    const metadataRaw = (state as {metadata?: unknown}).metadata
    const inputRaw = (state as {input?: unknown}).input
    const common: ShareToolState = {
        status: state.status,
        metadata: metadataRaw as ShareToolMetadata | undefined,
        input: inputRaw as ShareToolInput | undefined,
    }
    if (state.status === 'completed') {
        return {
            ...common,
            title: state.title,
            output: state.output,
        }
    }
    if (state.status === 'running') {
        return {
            ...common,
            title: state.title,
        }
    }
    if (state.status === 'error') {
        return {
            ...common,
            title: state.error,
            output: state.error,
        }
    }
    return common
}

export type DebugFn = (message: string) => void

export function handleMessageUpdated(
    event: EventMessageUpdated,
    ctx: AgentContext,
    grouper: OpencodeGrouper,
): void {
    const message = event.properties.info
    grouper.ensureSession(message.sessionID, ctx)
    grouper.recordMessageRole(message.sessionID, message.id, message.role, ctx)

    const completed =
        typeof (message as {time?: {completed?: unknown}}).time?.completed === 'number' ||
        typeof (message as {finish?: unknown}).finish === 'string'
    grouper.recordMessageCompleted(message.sessionID, message.id, completed, ctx)
}

export function handleMessagePartUpdated(
    event: EventMessagePartUpdated,
    ctx: AgentContext,
    grouper: OpencodeGrouper,
    debug: DebugFn,
): void {
    const part = event.properties.part

    if (part.type === 'text') {
        const textPart = part as TextPart
        debug(`text part ${textPart.sessionID}/${textPart.messageID}/${textPart.id}: ${textPart.text.slice(0, 120)}`)
        const completed = typeof textPart.time?.end === 'number'
        grouper.recordTextPart(textPart.sessionID, textPart.messageID, textPart.id, textPart.text, completed, ctx)
        return
    }

    if (part.type === 'reasoning') {
        const reasoningPart = part as ReasoningPart
        const completed = typeof reasoningPart.time?.end === 'number'
        debug(
            `reasoning part ${reasoningPart.sessionID}/${reasoningPart.messageID}/${reasoningPart.id}: ${reasoningPart.text.slice(0, 120)}`,
        )
        grouper.recordReasoningPart(
            reasoningPart.sessionID,
            reasoningPart.messageID,
            reasoningPart.id,
            reasoningPart.text,
            completed,
            ctx,
        )
        return
    }

    if (part.type === 'tool') {
        const toolPart = part as ToolPart
        const shareContent: ShareToolContent = {
            type: 'tool',
            id: toolPart.id,
            messageID: toolPart.messageID,
            sessionID: toolPart.sessionID,
            callID: toolPart.callID,
            tool: toolPart.tool,
            state: mapToolState(toolPart.state),
        }
        debug(
            `tool part ${toolPart.sessionID}/${toolPart.messageID}/${toolPart.id} tool=${toolPart.tool} status=${toolPart.state.status}`,
        )
        grouper.handleToolEvent(ctx, shareContent)
    }
}

export function handleTodoUpdated(
    event: EventTodoUpdated,
    ctx: AgentContext,
    debug: DebugFn,
): void {
    debug(`todo.updated for session ${event.properties.sessionID} (${event.properties.todos.length} items)`)
    const todos: AttemptTodoSummary = (() => {
        const items = event.properties.todos.map((todo: Todo, index: number) => {
            const id = todo.id && todo.id.trim().length ? todo.id : `todo-${index}`
            const status = todo.status === 'completed' ? 'done' : 'open'
            return {
                id,
                text: todo.content,
                status,
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

export function handleSessionError(
    event: EventSessionError,
    ctx: AgentContext,
    debug: DebugFn,
): void {
    const error = event.properties.error
    if (!error) return
    let message = 'OpenCode session error'
    const name = error.name
    const data = (error as {data?: unknown}).data as {message?: unknown} | undefined
    if (typeof data?.message === 'string') {
        message = data.message
    } else if (typeof name === 'string' && name.length) {
        message = name
    }
    debug(`session.error: ${message}`)
    ctx.emit({
        type: 'conversation',
        item: {
            type: 'error',
            timestamp: nowIso(),
            text: message,
        },
    })
    throw new Error(message)
}

export function handleEvent(
    event: unknown,
    ctx: AgentContext,
    profile: OpencodeProfile,
    grouper: OpencodeGrouper,
    debugFn: (profile: OpencodeProfile, ctx: AgentContext, message: string) => void,
): void {
    if (!event || typeof event !== 'object' || typeof (event as {type?: unknown}).type !== 'string') return
    const ev = event as SessionEvent

    const targetSessionId = ctx.sessionId
    const eventSessionId = extractSessionId(ev)

    const debug = (msg: string) => debugFn(profile, ctx, msg)

    if (targetSessionId) {
        if (!eventSessionId) {
            debug(`dropping event ${ev.type} (missing session id)`)
            return
        }
        if (targetSessionId !== eventSessionId) {
            debug(`dropping event ${ev.type} session=${eventSessionId} (expected ${targetSessionId})`)
            return
        }
    }

    debug(`event ${ev.type}${eventSessionId ? ` session=${eventSessionId}` : ''}`)

    switch (ev.type) {
        case 'message.updated':
            handleMessageUpdated(ev as EventMessageUpdated, ctx, grouper)
            break
        case 'message.part.updated':
            handleMessagePartUpdated(ev as EventMessagePartUpdated, ctx, grouper, debug)
            break
        case 'todo.updated':
            handleTodoUpdated(ev as EventTodoUpdated, ctx, debug)
            break
        case 'session.error':
            handleSessionError(ev as EventSessionError, ctx, debug)
            break
        default:
            break
    }
}
