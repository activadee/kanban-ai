import {getAgent} from './registry'
import type {
    Agent,
    InlineTaskContext,
    InlineTaskInputByKind,
    InlineTaskKind,
    InlineTaskResultByKind,
    InlineTaskErrorCode,
} from './types'
import {InlineTaskError, isInlineTaskError} from './types'

export type RunInlineTaskOptions<K extends InlineTaskKind> = {
    agentKey: string
    kind: K
    input: InlineTaskInputByKind[K]
    profile: unknown
    context: InlineTaskContext
    /**
     * Optional AbortSignal for cancellation. For ticketEnhance this should
     * usually be the signal from TicketEnhanceInput.
     */
    signal?: AbortSignal
}

function createAbortSignal(source?: AbortSignal): AbortSignal | undefined {
    if (!source) return undefined
    const controller = new AbortController()
    const onAbort = () => controller.abort('inline task aborted')
    if (source.aborted) {
        onAbort()
    } else {
        source.addEventListener('abort', onAbort, {once: true})
    }
    return controller.signal
}

export async function runInlineTask<K extends InlineTaskKind>(
    opts: RunInlineTaskOptions<K>,
): Promise<InlineTaskResultByKind[K]> {
    const {agentKey, kind, input, profile, context} = opts

    const agent = getAgent(agentKey) as Agent<unknown> | undefined
    if (!agent) {
        throw new InlineTaskError({
            kind,
            agent: agentKey,
            code: 'UNKNOWN_AGENT',
            message: `Unknown agent: ${agentKey}`,
        })
    }

    if (!agent.inline) {
        const code: InlineTaskErrorCode = 'AGENT_NO_INLINE'
        const message =
            kind === 'ticketEnhance'
                ? `Agent ${agentKey} does not support ticket enhancement`
                : `Agent ${agentKey} does not support inline task: ${kind}`
        throw new InlineTaskError({
            kind,
            agent: agentKey,
            code,
            message,
        })
    }

    const inputSignal = (input as {signal?: AbortSignal | null}).signal ?? undefined
    const effectiveSignal = createAbortSignal(opts.signal ?? inputSignal)

    const startedAt = Date.now()
    try {
        const result = await agent.inline(
            kind,
            input as InlineTaskInputByKind[K],
            profile as unknown,
            {context, signal: effectiveSignal},
        )
        return result as InlineTaskResultByKind[K]
    } catch (err) {
        const durationMs = Date.now() - startedAt
        const aborted =
            (effectiveSignal && effectiveSignal.aborted) ||
            (err as {name?: string} | null)?.name === 'AbortError'

        if (isInlineTaskError(err)) {
            // Preserve existing InlineTaskError to avoid double-wrapping.
            return Promise.reject(err)
        }

        const code: InlineTaskErrorCode = aborted ? 'ABORTED' : 'INLINE_TASK_FAILED'
        const defaultMessage =
            kind === 'ticketEnhance'
                ? 'Failed to enhance ticket'
                : `Inline task ${kind} failed`

        const message =
            err instanceof Error && err.message && !aborted ? err.message : defaultMessage

        // For now, keep tracing lightweight and rely on upstream logging for details.
        // Future inline kinds can hook into a structured logger if needed.
        if (!aborted) {
            // eslint-disable-next-line no-console
            console.warn(
                `[agents:inline] ${kind} failed for agent ${agentKey} after ${durationMs}ms: ${String(message)}`,
            )
        }

        throw new InlineTaskError({
            kind,
            agent: agentKey,
            code,
            message,
            cause: err ?? undefined,
        })
    }
}

