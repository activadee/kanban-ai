export function extractAgentProfileAppendPrompt(profile: unknown): string {
    if (!profile || typeof profile !== 'object') return ''
    const value = (profile as Record<string, unknown>).appendPrompt
    return typeof value === 'string' ? value.trim() : ''
}

export function buildImplementationFollowupPrompt(
    followupPrompt: string,
    profile: unknown,
): string {
    const base = (followupPrompt ?? '').trim()
    const append = extractAgentProfileAppendPrompt(profile)
    if (!append) return base
    if (!base) return append
    return `${base}\n\n${append}`
}

export function stripProfilePromptsForPlanning(profile: unknown): unknown {
    if (!profile || typeof profile !== 'object') return profile
    const base = profile as Record<string, unknown>
    return {
        ...base,
        appendPrompt: null,
        inlineProfile: null,
    }
}

