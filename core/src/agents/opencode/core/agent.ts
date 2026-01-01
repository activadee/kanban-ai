import type {
    Event,
    SessionCreateResponse,
    SessionPromptResponse,
} from '@opencode-ai/sdk'
import {createOpencodeClient, createOpencodeServer, type OpencodeClient} from '@opencode-ai/sdk'
import type {
    AgentContext,
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import {SdkAgent, type SdkSession} from '../../sdk'
import {OpencodeProfileSchema, defaultProfile, type OpencodeProfile} from '../profiles/schema'
import {OpencodeGrouper} from '../runtime/grouper'
import {createEnhanceContext, createPrSummaryContext, createConsoleEmit} from '../../sdk/context-factory'
import {getEffectiveInlinePrompt} from '../../profiles/base'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown, imageToDataUrl} from '../../utils'
import {asOpencodeError} from './errors'
import {
    DEFAULT_OPENCODE_PORT,
    getEffectivePort,
    isValidPort,
    OpencodeServerManager,
    type ServerInstance,
} from './server'
import {
    extractSessionId,
    handleEvent as handleEventImpl,
    type SessionEvent,
} from './handlers'

const nowIso = () => new Date().toISOString()

export type OpencodeInstallation = {
    mode: 'remote' | 'local'
    directory: string
    baseUrl?: string
    apiKey?: string
}

// Re-export utilities for backward compatibility
export {DEFAULT_OPENCODE_PORT, isValidPort, getEffectivePort}

export class OpencodeImpl extends SdkAgent<OpencodeProfile, OpencodeInstallation> {
    key = 'OPENCODE' as const
    label = 'OpenCode Agent'
    defaultProfile = defaultProfile
    profileSchema = OpencodeProfileSchema
    capabilities = {resume: true}

    private readonly groupers = new Map<string, OpencodeGrouper>()

    static async shutdownAllServers(): Promise<void> {
        return OpencodeServerManager.shutdownAllServers()
    }

    static getActiveServerCount(): number {
        return OpencodeServerManager.getActiveServerCount()
    }

    static isShuttingDown(): boolean {
        return OpencodeServerManager.isShuttingDown()
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
            return createOpencodeClient({
                baseUrl: installation.baseUrl,
                directory: installation.directory,
            })
        }

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

        const existingServer = OpencodeServerManager.getServer(port)
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

        const server = await createOpencodeServer({port})
        const serverInstance: ServerInstance = {
            close: server.close,
            url: server.url,
            port,
        }
        OpencodeServerManager.setServer(port, serverInstance)

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

    private buildModelConfig(profile: OpencodeProfile):
        | {providerID: string; modelID: string}
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

    protected handleEvent(event: unknown, ctx: AgentContext, profile: OpencodeProfile): void {
        const grouper = this.getGrouper(ctx)
        handleEventImpl(event, ctx, profile, grouper, this.debug.bind(this))
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

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle hooks
    // ─────────────────────────────────────────────────────────────────────────

    protected onRunStart(ctx: AgentContext, profile: OpencodeProfile, mode: 'run' | 'resume'): void {
        this.groupers.set(ctx.attemptId, new OpencodeGrouper(ctx.worktreePath))

        if (mode === 'run') {
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
        } else {
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
        }
    }

    protected onRunEnd(ctx: AgentContext, _profile: OpencodeProfile, _mode: 'run' | 'resume'): void {
        this.groupers.delete(ctx.attemptId)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inline task implementations (used by SdkAgent.inline())
    // ─────────────────────────────────────────────────────────────────────────

    async enhance(input: TicketEnhanceInput, profile: OpencodeProfile): Promise<TicketEnhanceResult> {
        const enhanceCtx = createEnhanceContext(input, createConsoleEmit())
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
        const effectiveAppend = getEffectiveInlinePrompt(profile)
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
        const summaryCtx = createPrSummaryContext(input, signal, createConsoleEmit())
        const installation = await this.detectInstallation(profile, summaryCtx)
        const client = (await this.createClient(profile, summaryCtx, installation)) as OpencodeClient
        const opencode = client

        let session: SessionCreateResponse
        try {
            session = (await opencode.session.create({
                query: {directory: installation.directory},
                body: {title: summaryCtx.cardTitle},
                signal: summaryCtx.signal,
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
        const effectiveAppend = getEffectiveInlinePrompt(profile)
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
                signal: summaryCtx.signal,
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
}

export const OpencodeAgent = new OpencodeImpl()
