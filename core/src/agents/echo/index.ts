import {z} from 'zod'

import type {
    Agent,
    AgentContext,
    InlineTaskContext,
    InlineTaskInputByKind,
    InlineTaskKind,
    InlineTaskResultByKind,
    PrSummaryInlineInput,
    PrSummaryInlineResult,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from '../types'

type EchoProfile = Record<string, never>

class EchoImpl implements Agent<EchoProfile> {
    key = 'ECHO' as const
    label = 'Echo Agent'
    defaultProfile: EchoProfile = {}
    profileSchema = z.object({}).strict()

    async run(_ctx: AgentContext, _profile: EchoProfile): Promise<number> {
        // Echo agent is intended only for tests; no-op run.
        return 0
    }

    async resume(_ctx: AgentContext, _profile: EchoProfile): Promise<number> {
        // Echo agent is intended only for tests; no-op resume.
        return 0
    }

    async inline<K extends InlineTaskKind>(
        kind: K,
        input: InlineTaskInputByKind[K],
        _profile: EchoProfile,
        _opts?: {context: InlineTaskContext; signal?: AbortSignal},
    ): Promise<InlineTaskResultByKind[K]> {
        if (kind === 'ticketEnhance') {
            const typed = input as TicketEnhanceInput
            const result: TicketEnhanceResult = {
                title: typed.title,
                description: `[ENHANCED] ${typed.description}`,
            }
            return result as InlineTaskResultByKind[K]
        }
        if (kind === 'prSummary') {
            const typed = input as PrSummaryInlineInput
            const fallbackTitle = `PR for ${typed.headBranch} -> ${typed.baseBranch}`
            const result: PrSummaryInlineResult = {
                title: fallbackTitle,
                body: `[SUMMARY] Changes from ${typed.baseBranch} to ${typed.headBranch} in ${typed.repositoryPath}`,
            }
            return result as InlineTaskResultByKind[K]
        }
        throw new Error(`Echo inline kind ${kind} is not implemented`)
    }

    async enhance(input: TicketEnhanceInput, _profile: EchoProfile): Promise<TicketEnhanceResult> {
        return {
            title: input.title,
            description: `[ENHANCED] ${input.description}`,
        }
    }
}

export const EchoAgent = new EchoImpl()
