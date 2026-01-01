import {z} from 'zod'

/**
 * Base profile schema containing fields common to all agents.
 * Agent-specific profiles should extend this schema.
 */
export const BaseProfileSchema = z.object({
    /**
     * Additional prompt text appended to the task prompt.
     */
    appendPrompt: z.string().nullable().optional(),
    /**
     * Alternative prompt for inline tasks (ticketEnhance, prSummary).
     * When set, used instead of appendPrompt for inline operations.
     */
    inlineProfile: z.string().nullable().optional(),
    /**
     * Enable debug logging for the agent.
     */
    debug: z.boolean().optional(),
})

export type BaseProfile = z.infer<typeof BaseProfileSchema>

/**
 * Helper to get the effective inline/append prompt from a profile.
 */
export function getEffectiveInlinePrompt(profile: BaseProfile): string | undefined {
    const inline = typeof profile.inlineProfile === 'string' ? profile.inlineProfile.trim() : ''
    if (inline.length > 0) return inline
    const append = typeof profile.appendPrompt === 'string' ? profile.appendPrompt.trim() : ''
    if (append.length > 0) return append
    return undefined
}
