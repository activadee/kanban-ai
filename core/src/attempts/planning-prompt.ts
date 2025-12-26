export function buildPlanningAttemptDescription(
    originalDescription: string | null | undefined,
): string {
    const original = (originalDescription ?? '').trim()
    const ticketSection = original.length
        ? `## Ticket Description\n\n${original}`
        : `## Ticket Description\n\n(No description provided.)`

    return [
        '## Planning Mode',
        '',
        'You are in **planning mode** for this ticket.',
        '',
        '### Goals',
        '- Ask clarifying questions when requirements are unclear.',
        '- Propose a concrete implementation plan (no code changes yet).',
        '- Identify risks, edge cases, and the tests we should add/update.',
        '',
        '### Rules',
        '- Do not modify files, create commits, or make a PR in this attempt.',
        '- You may inspect the repository using read-only commands if needed.',
        '- Prefer a single, well-structured Markdown response.',
        '- End with a section titled **## Plan** that can be saved as the plan for this ticket.',
        '',
        '---',
        '',
        ticketSection,
    ].join('\n')
}
