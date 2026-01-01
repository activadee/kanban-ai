/**
 * OpenCode inline task implementations.
 */
import type {SessionCreateResponse, SessionPromptResponse, OpencodeClient} from '@opencode-ai/sdk'
import type {
    AgentContext,
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../../types'
import type {OpencodeProfile} from '../profiles/schema'
import {createEnhanceContext, createPrSummaryContext, createConsoleEmit} from '../../sdk/context-factory'
import {getEffectiveInlinePrompt} from '../../profiles/base'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown} from '../../utils'
import {asOpencodeError} from './errors'
import type {OpencodeInstallation} from './agent'

function extractPromptMarkdown(response: SessionPromptResponse): string {
    const targetMessageId = response.info.id
    let text = ''

    for (const part of response.parts) {
        if (part.type === 'text' && part.messageID === targetMessageId) {
            text += part.text
        }
    }

    return text.trim()
}

export type InlineContext = {
    detectInstallation: (profile: OpencodeProfile, ctx: AgentContext) => Promise<OpencodeInstallation>
    createClient: (profile: OpencodeProfile, ctx: AgentContext, installation: OpencodeInstallation) => Promise<OpencodeClient>
    buildSystemPrompt: (profile: OpencodeProfile) => string | undefined
    buildModelConfig: (profile: OpencodeProfile) => {providerID: string; modelID: string} | undefined
}

export async function enhance(
    input: TicketEnhanceInput,
    profile: OpencodeProfile,
    ctx: InlineContext,
): Promise<TicketEnhanceResult> {
    const enhanceCtx = createEnhanceContext(input, createConsoleEmit())
    const installation = await ctx.detectInstallation(profile, enhanceCtx)
    const opencode = await ctx.createClient(profile, enhanceCtx, installation)

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

    const system = ctx.buildSystemPrompt(profile)
    const model = ctx.buildModelConfig(profile)
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

    const markdown = extractPromptMarkdown(response)
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

export async function summarizePullRequest(
    input: PrSummaryInlineInput,
    profile: OpencodeProfile,
    signal: AbortSignal | undefined,
    ctx: InlineContext,
): Promise<PrSummaryInlineResult> {
    const summaryCtx = createPrSummaryContext(input, signal, createConsoleEmit())
    const installation = await ctx.detectInstallation(profile, summaryCtx)
    const opencode = await ctx.createClient(profile, summaryCtx, installation)

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

    const system = ctx.buildSystemPrompt(profile)
    const model = ctx.buildModelConfig(profile)
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

    const markdown = extractPromptMarkdown(response)
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
