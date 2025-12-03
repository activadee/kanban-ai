import type {
    Event,
    EventMessagePartUpdated,
    EventMessageUpdated,
    EventSessionError,
    EventTodoUpdated,
    TextPart,
    ToolPart,
    ToolState,
    Todo,
    SessionCreateResponse,
} from '@opencode-ai/sdk'
import {createOpencodeClient, createOpencodeServer, type OpencodeClient} from '@opencode-ai/sdk'
import type {AgentContext} from '../../types'
import type {AttemptTodoSummary} from 'shared'
import {SdkAgent, type SdkSession} from '../../sdk'
import {OpencodeProfileSchema, defaultProfile, type OpencodeProfile} from '../profiles/schema'
import {OpencodeGrouper} from '../runtime/grouper'
import type {ShareToolContent, ShareToolInput, ShareToolMetadata, ShareToolState} from '../protocol/types'

const nowIso = () => new Date().toISOString()

export type OpencodeInstallation = {
    mode: 'remote' | 'local'
    directory: string
    baseUrl?: string
    apiKey?: string
}

type SessionEvent = Event

type ServerHandle = {
    close: () => void
}

class AsyncQueue<T> implements AsyncIterable<T> {
    private readonly values: T[] = []
    private readonly resolvers: Array<(result: IteratorResult<T>) => void> = []
    private closed = false

    push(value: T) {
        if (this.closed) return
        const resolver = this.resolvers.shift()
        if (resolver) {
            resolver({value, done: false})
        } else {
            this.values.push(value)
        }
    }

    close() {
        if (this.closed) return
        this.closed = true
        while (this.resolvers.length) {
            const resolve = this.resolvers.shift()
            if (resolve) resolve({value: undefined as unknown as T, done: true})
        }
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: () => {
                if (this.values.length) {
                    const value = this.values.shift() as T
                    return Promise.resolve({value, done: false})
                }
                if (this.closed) {
                    return Promise.resolve({value: undefined as unknown as T, done: true})
                }
                return new Promise<IteratorResult<T>>((resolve) => {
                    this.resolvers.push(resolve)
                })
            },
        }
    }
}

export class OpencodeImpl extends SdkAgent<OpencodeProfile, OpencodeInstallation> {
    key = 'OPENCODE' as const
    label = 'OpenCode Agent'
    defaultProfile = defaultProfile
    profileSchema = OpencodeProfileSchema
    capabilities = {resume: true}

    private readonly groupers = new Map<string, OpencodeGrouper>()
    private static localServer: ServerHandle | null = null
    private static localServerUrl: string | null = null

    protected async detectInstallation(profile: OpencodeProfile, ctx: AgentContext): Promise<OpencodeInstallation> {
        const directory = ctx.worktreePath
        const profileBaseUrl = profile.baseUrl?.trim() || undefined
        const envBaseUrl = process.env.OPENCODE_BASE_URL?.trim() || undefined
        const baseUrl = profileBaseUrl ?? envBaseUrl

        const profileApiKey = profile.apiKey?.trim() || undefined
        const envApiKey = process.env.OPENCODE_API_KEY?.trim() || undefined
        const apiKey = profileApiKey ?? envApiKey

        if (baseUrl) {
            if (!apiKey) {
                const message =
                    'OPENCODE_BASE_URL is set but no OpenCode API key was found. Set OPENCODE_API_KEY or profile.apiKey.'
                ctx.emit({type: 'log', level: 'error', message: `[opencode] ${message}`})
                throw new Error(message)
            }
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode] using remote OpenCode server at ${baseUrl}`,
            })
            return {mode: 'remote', directory, baseUrl, apiKey}
        }

        ctx.emit({
            type: 'log',
            level: 'info',
            message: '[opencode] using local OpenCode server (opencode serve)',
        })
        return {mode: 'local', directory, apiKey}
    }

    protected async createClient(
        _profile: OpencodeProfile,
        ctx: AgentContext,
        installation: OpencodeInstallation,
    ): Promise<OpencodeClient> {
        if (installation.mode === 'remote' && installation.baseUrl) {
            return createOpencodeClient({
                baseUrl: installation.baseUrl,
                directory: installation.directory,
            })
        }

        if (!OpencodeImpl.localServerUrl) {
            const server = await createOpencodeServer()
            OpencodeImpl.localServer = {close: server.close}
            OpencodeImpl.localServerUrl = server.url
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode] local server listening at ${server.url}`,
            })
        } else {
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode] reusing local server at ${OpencodeImpl.localServerUrl}`,
            })
        }

        return createOpencodeClient({
            baseUrl: OpencodeImpl.localServerUrl as string,
            directory: installation.directory,
        })
    }

    private buildSystemPrompt(profile: OpencodeProfile): string | undefined {
        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        if (inline.length > 0) return inline
        if (typeof profile.appendPrompt === 'string' && profile.appendPrompt.trim().length) {
            return profile.appendPrompt.trim()
        }
        return undefined
    }

    private buildModelConfig(profile: OpencodeProfile):
        | {
              providerID: string
              modelID: string
          }
        | undefined {
        const value = typeof profile.model === 'string' ? profile.model.trim() : ''
        if (!value) return undefined
        const slash = value.indexOf('/')
        if (slash <= 0 || slash === value.length - 1) {
            return undefined
        }
        return {
            providerID: value.slice(0, slash),
            modelID: value.slice(slash + 1),
        }
    }

    private async openEventStream(
        client: OpencodeClient,
        installation: OpencodeInstallation,
        ctx: AgentContext,
        signal: AbortSignal,
    ): Promise<AsyncQueue<SessionEvent>> {
        const events = await client.event.subscribe({
            query: {directory: installation.directory},
            signal,
        })
        const queue = new AsyncQueue<SessionEvent>()

        const pump = (async () => {
            try {
                for await (const raw of events.stream) {
                    const ev = raw as SessionEvent
                    queue.push(ev)
                    if (ev.type === 'session.idle') {
                        break
                    }
                }
            } catch (err) {
                if (!signal.aborted) {
                    ctx.emit({
                        type: 'log',
                        level: 'warn',
                        message: `[opencode] event stream error: ${String(err)}`,
                    })
                }
            } finally {
                queue.close()
            }
        })()
        void pump

        return queue
    }

    protected async startSession(
        client: unknown,
        prompt: string,
        profile: OpencodeProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        installation: OpencodeInstallation,
    ): Promise<SdkSession> {
        const opencode = client as OpencodeClient
        const stream = await this.openEventStream(opencode, installation, ctx, signal)

        const session = (await opencode.session.create({
            query: {directory: installation.directory},
            body: {title: ctx.cardTitle},
            responseStyle: 'data',
            throwOnError: true,
        })) as unknown as SessionCreateResponse

        ctx.sessionId = session.id
        ctx.emit({
            type: 'log',
            level: 'info',
            message: `[opencode] created session ${session.id}`,
        })

        const system = this.buildSystemPrompt(profile)
        const model = this.buildModelConfig(profile)
        const parts = prompt
            ? [
                  {
                      type: 'text' as const,
                      text: prompt,
                  },
              ]
            : []

        await opencode.session.prompt({
            path: {id: session.id},
            query: {directory: installation.directory},
            body: {
                agent: profile.agent,
                model,
                system,
                tools: undefined,
                parts,
            },
            responseStyle: 'data',
            throwOnError: true,
        })

        return {stream, sessionId: session.id}
    }

    protected async resumeSession(
        client: unknown,
        prompt: string,
        sessionId: string,
        profile: OpencodeProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        installation: OpencodeInstallation,
    ): Promise<SdkSession> {
        const opencode = client as OpencodeClient
        const stream = await this.openEventStream(opencode, installation, ctx, signal)

        const system = this.buildSystemPrompt(profile)
        const model = this.buildModelConfig(profile)
        const trimmedPrompt = prompt.trim()
        const parts = trimmedPrompt
            ? [
                  {
                      type: 'text' as const,
                      text: trimmedPrompt,
                  },
              ]
            : []

        await opencode.session.prompt({
            path: {id: sessionId},
            query: {directory: installation.directory},
            body: {
                agent: profile.agent,
                model,
                system,
                tools: undefined,
                parts,
            },
            responseStyle: 'data',
            throwOnError: true,
        })

        return {stream, sessionId}
    }

    private getGrouper(ctx: AgentContext): OpencodeGrouper {
        let grouper = this.groupers.get(ctx.attemptId)
        if (!grouper) {
            grouper = new OpencodeGrouper(ctx.worktreePath)
            this.groupers.set(ctx.attemptId, grouper)
        }
        return grouper
    }

    private debug(profile: OpencodeProfile, ctx: AgentContext, message: string) {
        if (!profile.debug) return
        ctx.emit({
            type: 'log',
            level: 'info',
            message: `[opencode:debug] ${message}`,
        })
    }

    private extractSessionId(event: SessionEvent): string | undefined {
        const properties = (event as {properties?: unknown}).properties
        if (!properties || typeof properties !== 'object') return undefined
        const props = properties as {sessionID?: unknown; info?: unknown; part?: unknown}

        if (typeof props.sessionID === 'string') return props.sessionID

        const info = props.info as {sessionID?: unknown} | undefined
        if (info && typeof info.sessionID === 'string') return info.sessionID

        const part = props.part as {sessionID?: unknown} | undefined
        if (part && typeof part.sessionID === 'string') return part.sessionID

        return undefined
    }

    private mapToolState(state: ToolState): ShareToolState {
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

    private handleMessageUpdated(event: EventMessageUpdated, ctx: AgentContext, profile: OpencodeProfile) {
        const message = event.properties.info
        const grouper = this.getGrouper(ctx)
        grouper.ensureSession(message.sessionID, ctx)
        grouper.recordMessageRole(message.sessionID, message.id, message.role)
    }

    private handleMessagePartUpdated(event: EventMessagePartUpdated, ctx: AgentContext, profile: OpencodeProfile) {
        const part = event.properties.part
        const grouper = this.getGrouper(ctx)

        if (part.type === 'text') {
            const textPart = part as TextPart
            this.debug(
                profile,
                ctx,
                `text part ${textPart.sessionID}/${textPart.messageID}/${textPart.id}: ${textPart.text.slice(0, 120)}`,
            )
            grouper.recordMessagePart(textPart.sessionID, textPart.messageID, textPart.id, textPart.text)
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
                state: this.mapToolState(toolPart.state),
            }
            this.debug(
                profile,
                ctx,
                `tool part ${toolPart.sessionID}/${toolPart.messageID}/${toolPart.id} tool=${toolPart.tool} status=${toolPart.state.status}`,
            )
            grouper.handleToolEvent(ctx, shareContent)
        }
    }

    private handleTodoUpdated(event: EventTodoUpdated, ctx: AgentContext, profile: OpencodeProfile) {
        this.debug(
            profile,
            ctx,
            `todo.updated for session ${event.properties.sessionID} (${event.properties.todos.length} items)`,
        )
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

    private handleSessionError(event: EventSessionError, ctx: AgentContext, profile: OpencodeProfile) {
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
        this.debug(profile, ctx, `session.error: ${message}`)
        ctx.emit({
            type: 'conversation',
            item: {
                type: 'error',
                timestamp: nowIso(),
                text: message,
            },
        })
    }

    protected handleEvent(event: unknown, ctx: AgentContext, profile: OpencodeProfile): void {
        if (!event || typeof event !== 'object' || typeof (event as {type?: unknown}).type !== 'string') return
        const ev = event as SessionEvent

        const targetSessionId = ctx.sessionId
        const eventSessionId = this.extractSessionId(ev)
        if (targetSessionId && eventSessionId && targetSessionId !== eventSessionId) return

        this.debug(profile, ctx, `event ${ev.type}${eventSessionId ? ` session=${eventSessionId}` : ''}`)

        switch (ev.type) {
            case 'message.updated':
                this.handleMessageUpdated(ev as EventMessageUpdated, ctx, profile)
                break
            case 'message.part.updated':
                this.handleMessagePartUpdated(ev as EventMessagePartUpdated, ctx, profile)
                break
            case 'todo.updated':
                this.handleTodoUpdated(ev as EventTodoUpdated, ctx, profile)
                break
            case 'session.error':
                this.handleSessionError(ev as EventSessionError, ctx, profile)
                break
            default:
                break
        }
    }

    async run(ctx: AgentContext, profile: OpencodeProfile): Promise<number> {
        this.groupers.set(ctx.attemptId, new OpencodeGrouper(ctx.worktreePath))
        const prompt = this.buildPrompt(profile, ctx)
        if (prompt) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'user',
                    text: prompt,
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                },
            })
        }
        try {
            return await super.run(ctx, profile)
        } finally {
            const grouper = this.groupers.get(ctx.attemptId)
            if (grouper) {
                try {
                    grouper.flush(ctx)
                } catch {
                    // ignore
                }
                this.groupers.delete(ctx.attemptId)
            }
        }
    }

    async resume(ctx: AgentContext, profile: OpencodeProfile): Promise<number> {
        if (!ctx.sessionId) {
            ctx.emit({
                type: 'log',
                level: 'error',
                message: '[opencode] resume called without sessionId',
            })
            throw new Error('OpenCode resume requires sessionId')
        }
        this.groupers.set(ctx.attemptId, new OpencodeGrouper(ctx.worktreePath))
        const prompt = (ctx.followupPrompt ?? '').trim()
        if (prompt.length) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'user',
                    text: prompt,
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                },
            })
        }
        try {
            return await super.resume(ctx, profile)
        } finally {
            const grouper = this.groupers.get(ctx.attemptId)
            if (grouper) {
                try {
                    grouper.flush(ctx)
                } catch {
                    // ignore
                }
                this.groupers.delete(ctx.attemptId)
            }
        }
    }
}

export const OpencodeAgent = new OpencodeImpl()
