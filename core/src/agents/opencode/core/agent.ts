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
    SessionCreateResponse,
    SessionPromptResponse,
} from '@opencode-ai/sdk'
import {createOpencodeClient, createOpencodeServer, type OpencodeClient} from '@opencode-ai/sdk'
import type {
    AgentContext,
    InlineTaskContext,
    InlineTaskInputByKind,
    InlineTaskKind,
    InlineTaskResultByKind,
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import type {AttemptTodoSummary} from 'shared'
import {SdkAgent, type SdkSession} from '../../sdk'
import {OpencodeProfileSchema, defaultProfile, type OpencodeProfile} from '../profiles/schema'
import {OpencodeGrouper} from '../runtime/grouper'
import type {ShareToolContent, ShareToolInput, ShareToolMetadata, ShareToolState} from '../protocol/types'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown} from '../../utils'

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
    private readonly resolvers: Array<{
        resolve: (result: IteratorResult<T>) => void
        reject: (err: unknown) => void
    }> = []
    private closed = false
    private ended = false
    private error: unknown | null = null

    constructor(private readonly onEnd?: () => void) {}

    private notifyEnd() {
        if (this.ended) return
        this.ended = true
        this.onEnd?.()
    }

    push(value: T) {
        if (this.closed) return
        const resolver = this.resolvers.shift()
        if (resolver) {
            resolver.resolve({value, done: false})
        } else {
            this.values.push(value)
        }
    }

    fail(err: unknown) {
        if (this.closed) return
        this.error = err
        this.closed = true
        while (this.resolvers.length) {
            const pending = this.resolvers.shift()
            if (pending) pending.reject(err)
        }
        this.notifyEnd()
    }

    close() {
        if (this.closed) return
        this.closed = true
        while (this.resolvers.length) {
            const pending = this.resolvers.shift()
            if (pending) pending.resolve({value: undefined as unknown as T, done: true})
        }
        this.notifyEnd()
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: () => {
                if (this.error) return Promise.reject(this.error)
                if (this.values.length) {
                    const value = this.values.shift() as T
                    return Promise.resolve({value, done: false})
                }
                if (this.closed) {
                    return Promise.resolve({value: undefined as unknown as T, done: true})
                }
                return new Promise<IteratorResult<T>>((resolve, reject) => {
                    this.resolvers.push({resolve, reject})
                })
            },
            return: () => {
                this.close()
                return Promise.resolve({value: undefined as unknown as T, done: true})
            },
            throw: (err) => {
                this.fail(err)
                return Promise.reject(err)
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
            // Remote server is responsible for its own authentication; apiKey
            // is not sent from this client.
            return createOpencodeClient({
                baseUrl: installation.baseUrl,
                directory: installation.directory,
            })
        }

        // For local servers, mirror apiKey into the environment so the spawned
        // `opencode` process can pick it up (e.g. OPENCODE_API_KEY).
        if (installation.apiKey && !process.env.OPENCODE_API_KEY) {
            process.env.OPENCODE_API_KEY = installation.apiKey
            ctx.emit({
                type: 'log',
                level: 'info',
                message: '[opencode] applied profile.apiKey to OPENCODE_API_KEY for local server',
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

    private buildInlineAppendPrompt(profile: OpencodeProfile): string | undefined {
        const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
        if (inline.length > 0) return inline
        if (typeof profile.appendPrompt === 'string') {
            const trimmed = profile.appendPrompt.trim()
            if (trimmed.length > 0) return trimmed
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
        sessionId?: string,
    ): Promise<AsyncQueue<SessionEvent>> {
        const eventController = new AbortController()
        const onAbort = () => eventController.abort()
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, {once: true})

        const queue = new AsyncQueue<SessionEvent>(() => {
            signal.removeEventListener('abort', onAbort)
            eventController.abort()
        })
        const events = await client.event.subscribe({
            query: {directory: installation.directory},
            signal: eventController.signal,
        })

        const pump = (async () => {
            try {
                let sawTargetSession = false
                for await (const raw of events.stream) {
                    const ev = raw as SessionEvent
                    const evSessionId = this.extractSessionId(ev)

                    if (ev.type === 'session.idle') {
                        if (!sessionId) {
                            queue.push(ev)
                            break
                        }
                        if (evSessionId === sessionId) {
                            queue.push(ev)
                            break
                        }
                        if (!evSessionId && sawTargetSession) {
                            queue.push(ev)
                            break
                        }
                        continue
                    }

                    if (sessionId) {
                        if (!evSessionId) continue
                        if (evSessionId !== sessionId) continue
                        sawTargetSession = true
                    }

                    queue.push(ev)
                }
            } catch (err) {
                const aborted =
                    signal.aborted ||
                    eventController.signal.aborted ||
                    (err as {name?: unknown} | null)?.name === 'AbortError'
                if (!aborted) {
                    ctx.emit({
                        type: 'log',
                        level: 'warn',
                        message: `[opencode] event stream error: ${String(err)}`,
                    })
                    queue.fail(err)
                }
            } finally {
                queue.close()
            }
        })()
        void pump

        return queue
    }

    private async *awaitStreamWithPrompt(
        stream: AsyncIterable<SessionEvent>,
        promptPromise: Promise<unknown>,
    ): AsyncIterable<SessionEvent> {
        let streamError: unknown | null = null
        try {
            for await (const ev of stream) {
                yield ev
            }
        } catch (err) {
            streamError = err
            throw err
        } finally {
            if (streamError) {
                void promptPromise.catch(() => {})
            } else {
                await promptPromise
            }
        }
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

        const session = (await opencode.session.create({
            query: {directory: installation.directory},
            body: {title: ctx.cardTitle},
            signal,
            responseStyle: 'data',
            throwOnError: true,
        })) as unknown as SessionCreateResponse

        ctx.sessionId = session.id
        ctx.emit({
            type: 'log',
            level: 'info',
            message: `[opencode] created session ${session.id}`,
        })

        const stream = await this.openEventStream(opencode, installation, ctx, signal, session.id)

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

        const promptPromise = opencode.session.prompt({
            path: {id: session.id},
            query: {directory: installation.directory},
            body: {
                agent: profile.agent,
                model,
                system,
                tools: undefined,
                parts,
            },
            signal,
            responseStyle: 'data',
            throwOnError: true,
        })

        void promptPromise.catch((err) => {
            stream.fail(err)
        })

        return {stream: this.awaitStreamWithPrompt(stream, promptPromise), sessionId: session.id}
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
        const stream = await this.openEventStream(opencode, installation, ctx, signal, sessionId)

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

        const promptPromise = opencode.session.prompt({
            path: {id: sessionId},
            query: {directory: installation.directory},
            body: {
                agent: profile.agent,
                model,
                system,
                tools: undefined,
                parts,
            },
            signal,
            responseStyle: 'data',
            throwOnError: true,
        })

        void promptPromise.catch((err) => {
            stream.fail(err)
        })

        return {stream: this.awaitStreamWithPrompt(stream, promptPromise), sessionId}
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

        const completed =
            typeof (message as {time?: {completed?: unknown}}).time?.completed === 'number' ||
            typeof (message as {finish?: unknown}).finish === 'string'
        grouper.recordMessageCompleted(message.sessionID, message.id, completed)
        grouper.emitMessageIfCompleted(ctx, message.sessionID, message.id)
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
            const completed = typeof textPart.time?.end === 'number'
            grouper.recordMessagePart(textPart.sessionID, textPart.messageID, textPart.id, textPart.text, completed)
            grouper.emitMessageIfCompleted(ctx, textPart.sessionID, textPart.messageID)
            return
        }

        if (part.type === 'reasoning') {
            const reasoningPart = part as ReasoningPart
            const completed = typeof reasoningPart.time?.end === 'number'
            this.debug(
                profile,
                ctx,
                `reasoning part ${reasoningPart.sessionID}/${reasoningPart.messageID}/${reasoningPart.id}: ${reasoningPart.text.slice(0, 120)}`,
            )
            grouper.recordReasoningPart(
                reasoningPart.sessionID,
                reasoningPart.messageID,
                reasoningPart.id,
                reasoningPart.text,
                completed,
            )
            grouper.emitThinkingIfCompleted(
                ctx,
                reasoningPart.sessionID,
                reasoningPart.messageID,
                reasoningPart.id,
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
        if (targetSessionId && (!eventSessionId || targetSessionId !== eventSessionId)) return

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

    private extractPromptMarkdown(response: SessionPromptResponse): string {
        const targetMessageId = response.info.id
        let text = ''

        for (const part of response.parts) {
            if (part.type === 'text' && part.messageID === targetMessageId) {
                text += part.text
            }
        }

        return text.trim()
    }

    async inline<K extends InlineTaskKind>(
        kind: K,
        input: InlineTaskInputByKind[K],
        profile: OpencodeProfile,
        opts?: {context: InlineTaskContext; signal?: AbortSignal},
    ): Promise<InlineTaskResultByKind[K]> {
        if (kind === 'ticketEnhance') {
            const result = await this.enhance(input as TicketEnhanceInput, profile)
            return result as InlineTaskResultByKind[K]
        }
        if (kind === 'prSummary') {
            const result = await this.summarizePullRequest(
                input as PrSummaryInlineInput,
                profile,
                opts?.signal,
            )
            return result as InlineTaskResultByKind[K]
        }
        throw new Error(`OpenCode inline kind ${kind} is not implemented`)
    }

    async enhance(input: TicketEnhanceInput, profile: OpencodeProfile): Promise<TicketEnhanceResult> {
        const enhanceCtx: AgentContext = {
            attemptId: `enhance-${input.projectId}`,
            boardId: input.boardId,
            cardId: 'ticket',
            worktreePath: input.repositoryPath,
            repositoryPath: input.repositoryPath,
            branchName: input.baseBranch,
            baseBranch: input.baseBranch,
            cardTitle: input.title,
            cardDescription: input.description,
            ticketType: input.ticketType ?? null,
            profileId: input.profileId ?? null,
            sessionId: undefined,
            followupPrompt: undefined,
            signal: input.signal,
            emit: (event) => {
                if (event.type === 'log') {
                    const level = event.level ?? 'info'
                    const message = event.message
                    if (level === 'error') {
                        // eslint-disable-next-line no-console
                        console.error(message)
                    } else if (level === 'warn') {
                        // eslint-disable-next-line no-console
                        console.warn(message)
                    } else {
                        // eslint-disable-next-line no-console
                        console.info(message)
                    }
                }
            },
        }

        const installation = await this.detectInstallation(profile, enhanceCtx)
        const client = (await this.createClient(profile, enhanceCtx, installation)) as OpencodeClient
        const opencode = client

        const session = (await opencode.session.create({
            query: {directory: installation.directory},
            body: {title: enhanceCtx.cardTitle},
            signal: input.signal,
            responseStyle: 'data',
            throwOnError: true,
        })) as unknown as SessionCreateResponse

        const system = this.buildSystemPrompt(profile)
        const model = this.buildModelConfig(profile)
        const effectiveAppend = this.buildInlineAppendPrompt(profile)
        const basePrompt = buildTicketEnhancePrompt(input, effectiveAppend)
        const inlineGuard =
            'IMPORTANT: Inline ticket enhancement only. Do not edit or create files. Respond only with Markdown, first line "# <Title>", remaining lines ticket body, no extra commentary.'
        const prompt = `${basePrompt}\n\n${inlineGuard}`

        if (profile.debug) {
            enhanceCtx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode:inline] ticketEnhance sending prompt (length=${prompt.length}) for project=${input.projectId} board=${input.boardId}`,
            })
        }

        let response: SessionPromptResponse
        try {
            response = (await opencode.session.prompt({
                path: {id: session.id},
                query: {directory: installation.directory},
                body: {
                    agent: profile.agent,
                    model,
                    system,
                    tools: undefined,
                    parts: prompt
                        ? [
                              {
                                  type: 'text' as const,
                                  text: prompt,
                              },
                          ]
                        : [],
                },
                signal: input.signal,
                responseStyle: 'data',
            throwOnError: true,
        })) as unknown as SessionPromptResponse
        } catch (err) {
            enhanceCtx.emit({
                type: 'log',
                level: 'error',
                message: `[opencode] inline ticketEnhance failed: ${String(err)}`,
            })
            throw err
        }

        const markdown = this.extractPromptMarkdown(response)
        if (profile.debug) {
            enhanceCtx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode:inline] ticketEnhance received markdown (length=${markdown.length}) for project=${input.projectId}`,
            })
        }

        if (!markdown) {
            if (profile.debug) {
                enhanceCtx.emit({
                    type: 'log',
                    level: 'warn',
                    message:
                        '[opencode:inline] ticketEnhance received empty response, falling back to original title/description',
                })
            }
            return {
                title: input.title,
                description: input.description,
            }
        }
        const result = splitTicketMarkdown(markdown, input.title, input.description)
        if (profile.debug) {
            enhanceCtx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode:inline] ticketEnhance final result title="${result.title}" descriptionLength=${result.description.length}`,
            })
        }
        return result
    }

    async summarizePullRequest(
        input: PrSummaryInlineInput,
        profile: OpencodeProfile,
        signal?: AbortSignal,
    ): Promise<PrSummaryInlineResult> {
        const effectiveSignal = signal ?? new AbortController().signal

        const summaryCtx: AgentContext = {
            attemptId: `pr-summary-${input.repositoryPath}`,
            boardId: 'pr-summary',
            cardId: 'pr',
            worktreePath: input.repositoryPath,
            repositoryPath: input.repositoryPath,
            branchName: input.headBranch,
            baseBranch: input.baseBranch,
            cardTitle: `PR from ${input.headBranch} into ${input.baseBranch}`,
            cardDescription: undefined,
            ticketType: null,
            profileId: null,
            sessionId: undefined,
            followupPrompt: undefined,
            signal: effectiveSignal,
            emit: (event) => {
                if (event.type === 'log') {
                    const level = event.level ?? 'info'
                    const message = event.message
                    if (level === 'error') {
                        // eslint-disable-next-line no-console
                        console.error(message)
                    } else if (level === 'warn') {
                        // eslint-disable-next-line no-console
                        console.warn(message)
                    } else {
                        // eslint-disable-next-line no-console
                        console.info(message)
                    }
                }
            },
        }

        const installation = await this.detectInstallation(profile, summaryCtx)
        const client = (await this.createClient(profile, summaryCtx, installation)) as OpencodeClient
        const opencode = client

        const session = (await opencode.session.create({
            query: {directory: installation.directory},
            body: {title: summaryCtx.cardTitle},
            signal: effectiveSignal,
            responseStyle: 'data',
            throwOnError: true,
        })) as unknown as SessionCreateResponse

        const system = this.buildSystemPrompt(profile)
        const model = this.buildModelConfig(profile)
        const effectiveAppend = this.buildInlineAppendPrompt(profile)
        const basePrompt = buildPrSummaryPrompt(input, effectiveAppend)
        const inlineGuard =
            'IMPORTANT: Inline PR summary only. Do not edit or create files. Respond only with Markdown, first line "# <Title>", remaining lines PR body, no extra commentary.'
        const prompt = `${basePrompt}\n\n${inlineGuard}`

        let response: SessionPromptResponse
        try {
            response = (await opencode.session.prompt({
                path: {id: session.id},
                query: {directory: installation.directory},
                body: {
                    agent: profile.agent,
                    model,
                    system,
                    tools: undefined,
                    parts: prompt
                        ? [
                              {
                                  type: 'text' as const,
                                  text: prompt,
                              },
                          ]
                        : [],
                },
                signal: effectiveSignal,
                responseStyle: 'data',
                throwOnError: true,
            })) as unknown as SessionPromptResponse
        } catch (err) {
            summaryCtx.emit({
                type: 'log',
                level: 'error',
                message: `[opencode] inline prSummary failed: ${String(err)}`,
            })
            throw err
        }

        const fallbackTitle = `PR from ${input.headBranch} into ${input.baseBranch}`
        const fallbackBody = `Changes from ${input.baseBranch} to ${input.headBranch} in ${input.repositoryPath}`

        const markdown = this.extractPromptMarkdown(response)
        if (!markdown) {
            return {
                title: fallbackTitle,
                body: fallbackBody,
            }
        }
        const split = splitTicketMarkdown(markdown, fallbackTitle, fallbackBody)
        return {
            title: split.title,
            body: split.description,
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
