import type {PrSummaryInlineInput, TicketEnhanceInput, TicketEnhanceResult} from './types'

export function splitTicketMarkdown(
    markdown: string,
    fallbackTitle: string,
    fallbackDescription: string,
): TicketEnhanceResult {
    const normalized = markdown.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");

    let headingIndex = -1;
    let headingText = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const trimmedStart = line.trimStart();
        if (trimmedStart.startsWith("# ")) {
            headingIndex = i;
            headingText = trimmedStart.slice(2).trim();
            break;
        }
    }

    if (headingIndex === -1 || !headingText) {
        return { title: fallbackTitle, description: fallbackDescription };
    }

    const rest = lines
        .slice(headingIndex + 1)
        .join("\n")
        .trim();
    const description = rest || fallbackDescription;

    return {
        title: headingText,
        description,
    };
}

export function buildTicketEnhancePrompt(
    input: TicketEnhanceInput,
    appendPrompt?: string | null,
): string {
    const description = input.description?.trim() || "(keine Beschreibung)";

    const typeLine = input.ticketType ? `Type: ${input.ticketType}` : null;

    const base = [
        'You are a ticket generator for a software project.',
        '',
        'Input:',
        `Title: ${input.title}`,
        ...(typeLine ? [typeLine] : []),
        'Description:',
        description,
        '',
        'Task:',
        'Write an improved ticket that meets the following requirements:',
        '- Markdown.',
        '- First line: # <New title or unchanged title>.',
        '- Detailed description with steps and acceptance criteria.',
        '- No meta-explanation, only the ticket content.',
        '- Do not edit or create files.',
        '- Respond only with the ticket Markdown content, no additional commentary or instructions.',
    ].join('\n')

    const extra = (appendPrompt ?? '').trim()
    return extra ? `${base}\n\n${extra}` : base
}

export function buildPrSummaryPrompt(
    input: PrSummaryInlineInput,
    appendPrompt?: string | null,
): string {
    const parts: string[] = []

    parts.push('You are a pull request generator for a software project.')
    parts.push('')
    parts.push('Repository context:')
    parts.push(`- Repository path: ${input.repositoryPath}`)
    parts.push(`- Base branch: ${input.baseBranch}`)
    parts.push(`- Head branch: ${input.headBranch}`)

    const commitSummary = (input.commitSummary ?? '').trim()
    const diffSummary = (input.diffSummary ?? '').trim()

    if (commitSummary || diffSummary) {
        parts.push('')
        parts.push('Summary of changes between base and head:')
        if (commitSummary) {
            parts.push('')
            parts.push('Commits (base..head):')
            parts.push(commitSummary)
        }
        if (diffSummary) {
            parts.push('')
            parts.push('Diff summary (files and stats):')
            parts.push(diffSummary)
        }
    }

    parts.push('')
    parts.push('Task:')
    parts.push('Write a pull request title and body that meet the following requirements:')
    parts.push('- Markdown.')
    parts.push('- First line: # <New title or unchanged title>.')
    parts.push('- Detailed description of the changes with steps and rationale.')
    parts.push('- No meta-explanation, only the PR body content.')
    parts.push('- Do not edit or create files.')
    parts.push('- Respond only with the PR Markdown content, no additional commentary or instructions.')

    const base = parts.join('\n')
    const extra = (appendPrompt ?? '').trim()
    return extra ? `${base}\n\n${extra}` : base
}
