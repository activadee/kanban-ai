import {z} from 'zod'

import type {Agent, AgentContext, TicketEnhanceInput, TicketEnhanceResult} from '../types'

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

    async enhance(input: TicketEnhanceInput, _profile: EchoProfile): Promise<TicketEnhanceResult> {
        return {
            title: input.title,
            description: `[ENHANCED] ${input.description}`,
        }
    }
}

export const EchoAgent = new EchoImpl()

