import path from 'node:path'
import type {AgentContext} from '../../types'
import type {ConversationItem, ConversationRole} from 'shared'
import type {ShareToolContent, ShareToolState} from '../protocol/types'

const nowIso = () => new Date().toISOString()

type MessageState = {
    role?: ConversationRole
    order: string[]
    parts: Map<string, string>
    completedPartIds: Set<string>
    emittedPartIds: Set<string>
    messageCompleted: boolean
}

type ReasoningState = {
    text: string
    completed: boolean
    emitted: boolean
}

export class OpencodeGrouper {
    private emittedSessionId = false

    private readonly messages = new Map<string, MessageState>()
    private readonly reasoningParts = new Map<string, ReasoningState>()

    private readonly emittedToolParts = new Set<string>()

    constructor(private readonly worktreePath: string) {}

    ensureSession(sessionId: string | undefined, ctx: AgentContext) {
        if (!sessionId || this.emittedSessionId) return
        this.emittedSessionId = true
        ctx.emit({type: 'session', id: sessionId})
    }

    recordMessageRole(sessionId: string, messageId: string, role: string | undefined, ctx: AgentContext) {
        const messageKey = this.messageKey(sessionId, messageId)
        const state = this.getMessageState(messageKey)
        const normalized = normalizeRole(role)
        if (normalized) state.role = normalized
        this.emitReadyTextParts(ctx, state)
    }

    recordMessageCompleted(sessionId: string, messageId: string, completed: boolean, ctx: AgentContext) {
        if (!completed) return
        const messageKey = this.messageKey(sessionId, messageId)
        const state = this.getMessageState(messageKey)
        state.messageCompleted = true
        for (const partId of state.order) {
            state.completedPartIds.add(partId)
        }
        this.emitReadyTextParts(ctx, state)
    }

    recordTextPart(
        sessionId: string,
        messageId: string,
        partId: string,
        text: string,
        completed: boolean,
        ctx: AgentContext,
    ) {
        const messageKey = this.messageKey(sessionId, messageId)
        const state = this.getMessageState(messageKey)
        if (!state.order.includes(partId)) state.order.push(partId)
        state.parts.set(partId, text)
        if (completed || state.messageCompleted) state.completedPartIds.add(partId)
        this.emitReadyTextParts(ctx, state)
    }

    recordReasoningPart(
        sessionId: string,
        messageId: string,
        partId: string,
        text: string,
        completed: boolean,
        ctx: AgentContext,
    ) {
        const key = this.reasoningKey(sessionId, messageId, partId)
        const prev = this.reasoningParts.get(key)
        const state: ReasoningState = prev ?? {text: '', completed: false, emitted: false}
        state.text = text
        if (completed) state.completed = true
        this.reasoningParts.set(key, state)

        if (state.completed && !state.emitted) {
            const cleaned = text.trim()
            if (cleaned.length && !cleaned.includes('[REDACTED]')) {
                ctx.emit({
                    type: 'conversation',
                    item: {
                        type: 'thinking',
                        timestamp: nowIso(),
                        text: cleaned,
                        format: 'markdown',
                    },
                })
                state.emitted = true
                this.reasoningParts.set(key, state)
            }
        }
    }

    handleToolEvent(ctx: AgentContext, payload: ShareToolContent) {
        const status = payload.state?.status
        if (!status || (status !== 'completed' && status !== 'error')) return

        const key = `${payload.sessionID}:${payload.messageID}:${payload.id}`
        if (this.emittedToolParts.has(key)) return

        const item = this.buildToolConversationItem(payload)
        if (item) {
            ctx.emit({type: 'conversation', item})
            this.emittedToolParts.add(key)
        }
    }

    flush(ctx: AgentContext) {
        for (const state of this.messages.values()) {
            if (state.role !== 'assistant') continue
            for (const partId of state.order) {
                if (state.emittedPartIds.has(partId)) continue
                const text = state.parts.get(partId) ?? ''
                if (!text.trim()) continue
                ctx.emit({
                    type: 'conversation',
                    item: {
                        type: 'message',
                        timestamp: nowIso(),
                        role: 'assistant',
                        text,
                        format: 'markdown',
                        profileId: ctx.profileId ?? null,
                    },
                })
                state.emittedPartIds.add(partId)
            }
        }

        for (const [key, state] of this.reasoningParts) {
            if (state.emitted) continue
            const cleaned = state.text.trim()
            if (!cleaned.length || cleaned.includes('[REDACTED]')) continue
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'thinking',
                    timestamp: nowIso(),
                    text: cleaned,
                    format: 'markdown',
                },
            })
            state.emitted = true
            this.reasoningParts.set(key, state)
        }
    }

    private emitReadyTextParts(ctx: AgentContext, state: MessageState) {
        if (state.role !== 'assistant') return
        for (const partId of state.order) {
            if (!state.completedPartIds.has(partId)) continue
            if (state.emittedPartIds.has(partId)) continue
            const text = state.parts.get(partId) ?? ''
            if (!text.trim()) continue

            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'assistant',
                    text,
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                },
            })

            state.emittedPartIds.add(partId)
        }
    }

    private getMessageState(messageKey: string): MessageState {
        let state = this.messages.get(messageKey)
        if (!state) {
            state = {
                role: 'assistant',
                order: [],
                parts: new Map(),
                completedPartIds: new Set(),
                emittedPartIds: new Set(),
                messageCompleted: false,
            }
            this.messages.set(messageKey, state)
        }
        return state
    }

    private reasoningKey(sessionId: string, messageId: string, partId: string) {
        return `${sessionId}:${messageId}:${partId}`
    }

    private messageKey(sessionId: string, messageId: string) {
        return `${sessionId}:${messageId}`
    }

    private buildToolConversationItem(payload: ShareToolContent): ConversationItem | null {
        const startedAt = nowIso()
        const status = payload.state?.status ?? ''
        const convStatus = mapToolStatus(status)
        const invocation = {
            name: payload.tool,
            action: null,
            command: null,
            cwd: null,
            status: convStatus,
            startedAt,
            completedAt: convStatus === 'running' ? null : nowIso(),
            durationMs: null,
            exitCode: payload.state?.metadata?.exit ?? null,
            stdout: payload.state?.output ?? null,
            stderr: null,
            metadata: this.buildToolMetadata(payload),
        } as const
        return {
            type: 'tool',
            timestamp: nowIso(),
            tool: invocation,
        }
    }

    private buildToolMetadata(payload: ShareToolContent): Record<string, unknown> | undefined {
        const state = payload.state
        if (!state) return undefined
        const meta: Record<string, unknown> = {}
        if (state.title) meta.title = state.title
        if (state.metadata?.description) meta.description = state.metadata.description
        if (state.metadata?.diff) meta.diff = state.metadata.diff
        if (state.metadata?.preview) meta.preview = state.metadata.preview
        if (state.metadata?.count !== undefined) meta.count = state.metadata.count
        if (state.metadata?.truncated !== undefined) meta.truncated = state.metadata.truncated
        if (state.input) meta.input = normalizeToolInput(state.input, this.worktreePath)
        return Object.keys(meta).length ? meta : undefined
    }
}

function normalizeRole(role?: string): ConversationRole | undefined {
    if (!role) return undefined
    switch (role) {
        case 'system':
        case 'user':
            return role
        default:
            return 'assistant'
    }
}

function mapToolStatus(status: string) {
    switch (status) {
        case 'running':
            return 'running'
        case 'completed':
            return 'succeeded'
        case 'error':
            return 'failed'
        default:
            return 'created'
    }
}

function normalizeToolInput(input: ShareToolState['input'], worktreePath: string) {
    if (!input) return undefined
    const result: Record<string, unknown> = {}
    const rel = (value?: string | null) => (value ? makeRelative(value, worktreePath) : undefined)
    if (input.filePath) result.filePath = rel(input.filePath)
    if (input.path) result.path = rel(input.path)
    if (input.include) result.include = input.include
    if (input.pattern) result.pattern = input.pattern
    if (input.command) result.command = input.command
    if (input.description) result.description = input.description
    if (input.url) result.url = input.url
    if (input.format) result.format = input.format
    if (input.timeout !== undefined) result.timeout = input.timeout
    if (input.oldString) result.oldString = input.oldString
    if (input.newString) result.newString = input.newString
    if (input.todos) result.todos = input.todos
    return result
}

function makeRelative(target: string, worktreePath: string) {
    try {
        if (!path.isAbsolute(target)) return target
        const rel = path.relative(worktreePath, target)
        return rel || '.'
    } catch {
        return target
    }
}
