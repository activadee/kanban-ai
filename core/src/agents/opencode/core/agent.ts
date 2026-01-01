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
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown, imageToDataUrl} from '../../utils'

const nowIso = () => new Date().toISOString()

function stringifyShort(value: unknown): string {
    try {
        const json = JSON.stringify(value)
        if (!json) return ''
        return json.length > 500 ? json.slice(0, 497) + '...' : json
    } catch {
        return ''
    }
}

function describeOpencodeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message || String(err)
    }
    if (typeof err === 'string') {
        const trimmed = err.trim()
        return trimmed || 'Unknown OpenCode error'
    }
    if (!err || typeof err !== 'object') {
        return 'Unknown OpenCode error'
    }

    const record = err as Record<string, unknown>
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    if (message) return message

    const data = record.data
    if (data && typeof data === 'object') {
        const dataMsg = (data as Record<string, unknown>).message
        if (typeof dataMsg === 'string') {
            const trimmed = dataMsg.trim()
            if (trimmed) return trimmed
        }
    }

    const json = stringifyShort(err)
    if (json) return json

    return String(err)
}

function asOpencodeError(err: unknown, fallback: string): Error {
    const msg = describeOpencodeError(err)
    const message = msg && msg !== '[object Object]' ? msg : fallback
    return err === undefined ? new Error(message) : new Error(message, {cause: err})
}

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

type ServerInstance = ServerHandle & {
    url: string
    port: number
}

// Default port for OpenCode server
const DEFAULT_OPENCODE_PORT = 4097

// Reserved ports that should not be used
const RESERVED_PORTS = new Set([80, 443, 22, 25, 53, 110, 143, 993, 995, 3306, 5432, 6379, 8080, 8443])

/**
 * Validates that a port number is within valid range and not reserved.
 * @param port - The port number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPort(port: unknown): port is number {
    return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 && !RESERVED_PORTS.has(port)
}

export function getEffectivePort(settingsPort: unknown): number {
    return isValidPort(settingsPort) ? settingsPort : DEFAULT_OPENCODE_PORT
}

export {DEFAULT_OPENCODE_PORT}


export class OpencodeImpl extends SdkAgent<OpencodeProfile, OpencodeInstallation> {
    key = 'OPENCODE' as const
    label = 'OpenCode Agent'
    defaultProfile = defaultProfile
    profileSchema = OpencodeProfileSchema
    capabilities = {resume: true}

    private readonly groupers = new Map<string, OpencodeGrouper>()
    private static readonly serversByPort = new Map<number, ServerInstance>()
    private static shutdownInProgress = false

    static async shutdownAllServers(): Promise<void> {
        if (OpencodeImpl.shutdownInProgress) {
            return
        }
        OpencodeImpl.shutdownInProgress = true

        const servers = Array.from(OpencodeImpl.serversByPort.entries())
        if (servers.length === 0) {
            OpencodeImpl.shutdownInProgress = false
            return
        }

        const closePromises = servers.map(async ([port, server]) => {
            try {
                server.close()
                OpencodeImpl.serversByPort.delete(port)
            } catch { }
        })

        await Promise.all(closePromises)
        OpencodeImpl.shutdownInProgress = false
    }

    static getActiveServerCount(): number {
        return OpencodeImpl.serversByPort.size
    }

    static isShuttingDown(): boolean {
        return OpencodeImpl.shutdownInProgress
    }

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
        profile: OpencodeProfile,
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

        const {ensureAppSettings} = await import('../../../settings/service')
        const settingsPort = (await ensureAppSettings()).opencodePort
        const port = getEffectivePort(settingsPort)

        // Check if we already have a server running on this port
        const existingServer = OpencodeImpl.serversByPort.get(port)

        if (existingServer) {
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode] reusing local server at ${existingServer.url} on port ${port}`,
            })
            return createOpencodeClient({
                baseUrl: existingServer.url,
                directory: installation.directory,
            })
        }

        // No existing server on this port, start a new one
        const server = await createOpencodeServer({port})
        const serverInstance: ServerInstance = {
            close: server.close,
            url: server.url,
            port,
        }
        OpencodeImpl.serversByPort.set(port, serverInstance)

        ctx.emit({
            type: 'log',
            level: 'info',
            message: `[opencode] local server listening at ${server.url} on port ${port}`,
        })

        return createOpencodeClient({
            baseUrl: server.url,
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

    private async createSessionStream(
        opencode: OpencodeClient,
        installation: OpencodeInstallation,
        profile: OpencodeProfile,
        ctx: AgentContext,
        signal: AbortSignal,
        sessionId: string,
        prompt: string,
    ): Promise<AsyncIterable<SessionEvent>> {
        const controller = new AbortController()
        const onAbort = () => controller.abort()
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, {once: true})

        const events = await opencode.event.subscribe({
            query: {directory: installation.directory},
            signal: controller.signal,
        })

        const system = this.buildSystemPrompt(profile)
        const model = this.buildModelConfig(profile)
        const trimmedPrompt = prompt.trim()

        const parts: Array<{type: 'text'; text: string} | {type: 'file'; mime: string; url: string; filename?: string}> = []

        if (trimmedPrompt) {
            parts.push({type: 'text' as const, text: trimmedPrompt})
        }

        if (ctx.images && ctx.images.length > 0) {
            for (const image of ctx.images) {
                parts.push({
                    type: 'file' as const,
                    mime: image.mime,
                    url: imageToDataUrl(image),
                    filename: image.name,
                })
            }
            ctx.emit({
                type: 'log',
                level: 'info',
                message: `[opencode] including ${ctx.images.length} image(s) in message`,
            })
        }

        const grouper = this.getGrouper(ctx)
        const debug = (message: string) => this.debug(profile, ctx, message)
        const POST_PROMPT_IDLE_TIMEOUT_MS = 60_000

        let promptDone = false
        let promptError: unknown | null = null
        let idleSeen = false
        let sawTargetSession = false
        let timedOut = false

        let postPromptTimer: ReturnType<typeof setTimeout> | null = null
        const resetPostPromptTimer = () => {
            if (postPromptTimer) clearTimeout(postPromptTimer)
            postPromptTimer = setTimeout(() => {
                timedOut = true
                controller.abort()
            }, POST_PROMPT_IDLE_TIMEOUT_MS)
        }

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
            signal: controller.signal,
            responseStyle: 'data',
            throwOnError: true,
        })

        void promptPromise
            .then(() => {
                promptDone = true
                if (!idleSeen) resetPostPromptTimer()
            })
            .catch((err) => {
                promptDone = true
                const aborted =
                    signal.aborted ||
                    controller.signal.aborted ||
                    (err as {name?: unknown} | null)?.name === 'AbortError'
                if (aborted) return
                promptError = err
                controller.abort()
            })

        const extractSessionId = (event: SessionEvent) => this.extractSessionId(event)

        async function* stream() {
            try {
                for await (const raw of events.stream) {
                    const ev = raw as SessionEvent
                    const evSessionId = extractSessionId(ev)

                    if (ev.type === 'session.idle') {
                        if (evSessionId === sessionId || (!evSessionId && sawTargetSession && promptDone)) {
                            idleSeen = true
                            yield ev
                            break
                        }
                        debug(`dropping session.idle${evSessionId ? ` session=${evSessionId}` : ''}`)
                        continue
                    }

                    if (!evSessionId) {
                        debug(`dropping event ${ev.type} (missing session id)`)
                        continue
                    }
                    if (evSessionId !== sessionId) continue

                    sawTargetSession = true
                    yield ev
                    if (promptDone && !idleSeen) resetPostPromptTimer()
                }
            } catch (err) {
                const aborted =
                    signal.aborted ||
                    controller.signal.aborted ||
                    (err as {name?: unknown} | null)?.name === 'AbortError'
                if (!aborted) throw err
            } finally {
                if (postPromptTimer) clearTimeout(postPromptTimer)
                signal.removeEventListener('abort', onAbort)
                controller.abort()
                grouper.flush(ctx)
            }

            await Promise.resolve()

            if (signal.aborted) throw new Error('aborted')
            if (timedOut) throw new Error('[opencode] timed out waiting for session.idle')
            if (promptError) throw promptError
            if (!idleSeen && !promptDone) {
                throw new Error('[opencode] event stream ended before completion')
            }
        }

        return stream()
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

        const stream = await this.createSessionStream(opencode, installation, profile, ctx, signal, session.id, prompt)
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
        const stream = await this.createSessionStream(opencode, installation, profile, ctx, signal, sessionId, prompt)
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
        grouper.recordMessageRole(message.sessionID, message.id, message.role, ctx)

        const completed =
            typeof (message as {time?: {completed?: unknown}}).time?.completed === 'number' ||
            typeof (message as {finish?: unknown}).finish === 'string'
        grouper.recordMessageCompleted(message.sessionID, message.id, completed, ctx)
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
            grouper.recordTextPart(textPart.sessionID, textPart.messageID, textPart.id, textPart.text, completed, ctx)
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
        throw new Error(message)
    }

    protected handleEvent(event: unknown, ctx: AgentContext, profile: OpencodeProfile): void {
        if (!event || typeof event !== 'object' || typeof (event as {type?: unknown}).type !== 'string') return
        const ev = event as SessionEvent

        const targetSessionId = ctx.sessionId
        const eventSessionId = this.extractSessionId(ev)
        if (targetSessionId) {
            if (!eventSessionId) {
                this.debug(profile, ctx, `dropping event ${ev.type} (missing session id)`)
                return
            }
            if (targetSessionId !== eventSessionId) {
                this.debug(profile, ctx, `dropping event ${ev.type} session=${eventSessionId} (expected ${targetSessionId})`)
                return
            }
        }

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

        let session: SessionCreateResponse
        try {
            session = (await opencode.session.create({
                query: {directory: installation.directory},
                body: {title: enhanceCtx.cardTitle},
                signal: input.signal,
                responseStyle: 'data',
                throwOnError: true,
            })) as unknown as SessionCreateResponse
        } catch (err) {
            const wrapped = asOpencodeError(err, 'OpenCode session create failed')
            enhanceCtx.emit({
                type: 'log',
                level: 'error',
                message: `[opencode] inline ticketEnhance session create failed: ${wrapped.message}`,
            })
            throw wrapped
        }

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
            const wrapped = asOpencodeError(err, 'OpenCode session prompt failed')
            enhanceCtx.emit({
                type: 'log',
                level: 'error',
                message: `[opencode] inline ticketEnhance failed: ${wrapped.message}`,
            })
            throw wrapped
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

        let session: SessionCreateResponse
        try {
            session = (await opencode.session.create({
                query: {directory: installation.directory},
                body: {title: summaryCtx.cardTitle},
                signal: effectiveSignal,
                responseStyle: 'data',
                throwOnError: true,
            })) as unknown as SessionCreateResponse
        } catch (err) {
            const wrapped = asOpencodeError(err, 'OpenCode session create failed')
            summaryCtx.emit({
                type: 'log',
                level: 'error',
                message: `[opencode] inline prSummary session create failed: ${wrapped.message}`,
            })
            throw wrapped
        }

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
            const wrapped = asOpencodeError(err, 'OpenCode session prompt failed')
            summaryCtx.emit({
                type: 'log',
                level: 'error',
                message: `[opencode] inline prSummary failed: ${wrapped.message}`,
            })
            throw wrapped
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
        if (prompt || (ctx.images && ctx.images.length > 0)) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'user',
                    text: prompt || '(image attached)',
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                    images: ctx.images,
                },
            })
        }
        try {
            return await super.run(ctx, profile)
        } finally {
            this.groupers.delete(ctx.attemptId)
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
        if (prompt.length || (ctx.images && ctx.images.length > 0)) {
            ctx.emit({
                type: 'conversation',
                item: {
                    type: 'message',
                    timestamp: nowIso(),
                    role: 'user',
                    text: prompt || '(image attached)',
                    format: 'markdown',
                    profileId: ctx.profileId ?? null,
                    images: ctx.images,
                },
            })
        }
        try {
            return await super.resume(ctx, profile)
        } finally {
            this.groupers.delete(ctx.attemptId)
        }
    }
}

export const OpencodeAgent = new OpencodeImpl()
