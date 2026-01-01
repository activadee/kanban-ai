/**
 * OpenCode session streaming utilities.
 */
import type {OpencodeClient} from '@opencode-ai/sdk'
import type {AgentContext} from '../../types'
import type {OpencodeProfile} from '../profiles/schema'
import type {OpencodeGrouper} from '../runtime/grouper'
import {imageToDataUrl} from '../../utils'
import {extractSessionId, type SessionEvent} from './handlers'
import type {OpencodeInstallation} from './agent'

const POST_PROMPT_IDLE_TIMEOUT_MS = 60_000

export type SessionStreamOptions = {
    opencode: OpencodeClient
    installation: OpencodeInstallation
    profile: OpencodeProfile
    ctx: AgentContext
    signal: AbortSignal
    sessionId: string
    prompt: string
    grouper: OpencodeGrouper
    buildSystemPrompt: () => string | undefined
    buildModelConfig: () => {providerID: string; modelID: string} | undefined
    debug: (message: string) => void
}

export async function createSessionStream(options: SessionStreamOptions): Promise<AsyncIterable<SessionEvent>> {
    const {
        opencode,
        installation,
        profile,
        ctx,
        signal,
        sessionId,
        prompt,
        grouper,
        buildSystemPrompt,
        buildModelConfig,
        debug,
    } = options

    const controller = new AbortController()
    const onAbort = () => controller.abort()
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, {once: true})

    const events = await opencode.event.subscribe({
        query: {directory: installation.directory},
        signal: controller.signal,
    })

    const system = buildSystemPrompt()
    const model = buildModelConfig()
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
