import type {SessionCreateResponse} from '@opencode-ai/sdk'
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
import {
    DEFAULT_OPENCODE_PORT,
    getEffectivePort,
    isValidPort,
    OpencodeServerManager,
    type ServerInstance,
} from './server'
import {handleEvent as handleEventImpl} from './handlers'
import {createSessionStream} from './streaming'
import {enhance as enhanceImpl, summarizePullRequest as summarizePrImpl, type InlineContext} from './inline'

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

    private buildModelConfig(profile: OpencodeProfile): {providerID: string; modelID: string} | undefined {
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

        const stream = await createSessionStream({
            opencode,
            installation,
            profile,
            ctx,
            signal,
            sessionId: session.id,
            prompt,
            grouper: this.getGrouper(ctx),
            buildSystemPrompt: () => this.buildSystemPrompt(profile),
            buildModelConfig: () => this.buildModelConfig(profile),
            debug: (msg) => this.debug(profile, ctx, msg),
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
        const stream = await createSessionStream({
            opencode,
            installation,
            profile,
            ctx,
            signal,
            sessionId,
            prompt,
            grouper: this.getGrouper(ctx),
            buildSystemPrompt: () => this.buildSystemPrompt(profile),
            buildModelConfig: () => this.buildModelConfig(profile),
            debug: (msg) => this.debug(profile, ctx, msg),
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

    protected handleEvent(event: unknown, ctx: AgentContext, profile: OpencodeProfile): void {
        const grouper = this.getGrouper(ctx)
        handleEventImpl(event, ctx, profile, grouper, this.debug.bind(this))
    }

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

    private getInlineContext(): InlineContext {
        return {
            detectInstallation: this.detectInstallation.bind(this),
            createClient: this.createClient.bind(this) as InlineContext['createClient'],
            buildSystemPrompt: this.buildSystemPrompt.bind(this),
            buildModelConfig: this.buildModelConfig.bind(this),
        }
    }

    async enhance(input: TicketEnhanceInput, profile: OpencodeProfile): Promise<TicketEnhanceResult> {
        return enhanceImpl(input, profile, this.getInlineContext())
    }

    async summarizePullRequest(
        input: PrSummaryInlineInput,
        profile: OpencodeProfile,
        signal?: AbortSignal,
    ): Promise<PrSummaryInlineResult> {
        return summarizePrImpl(input, profile, signal, this.getInlineContext())
    }
}

export const OpencodeAgent = new OpencodeImpl()
