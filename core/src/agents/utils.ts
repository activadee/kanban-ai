import {promises as fs} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {MessageImage, MessageImageMimeType} from 'shared'
import {getImageExtension} from 'shared'
import type {PrSummaryInlineInput, TicketEnhanceInput, TicketEnhanceResult} from './types'

const TEMP_IMAGES_DIR = join(tmpdir(), 'kanban-ai-images')

export async function saveImageToTempFile(image: MessageImage, prefix?: string): Promise<string> {
    const ext = getImageExtension(image.mime)
    const filename = `${prefix ?? 'image'}-${crypto.randomUUID()}.${ext}`
    await fs.mkdir(TEMP_IMAGES_DIR, {recursive: true})
    const filePath = join(TEMP_IMAGES_DIR, filename)
    const buffer = Buffer.from(image.data, 'base64')
    await fs.writeFile(filePath, buffer)
    return filePath
}

export async function cleanupTempImageFile(filePath: string): Promise<void> {
    await fs.unlink(filePath).catch(() => {})
}

export async function cleanupTempImageFiles(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map(cleanupTempImageFile))
}

export async function saveImagesToTempFiles(
    images: MessageImage[],
    prefix?: string,
): Promise<string[]> {
    return Promise.all(images.map((img, i) => saveImageToTempFile(img, `${prefix ?? 'img'}-${i}`)))
}

export function imageToDataUrl(image: MessageImage): string {
    return `data:${image.mime};base64,${image.data}`
}

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

    // Input context block - always included
    const inputContext = [
        '',
        'Input:',
        `Title: ${input.title}`,
        ...(typeLine ? [typeLine] : []),
        'Description:',
        description,
    ].join('\n')

    // Output format requirements - always enforced
    const outputFormat = [
        '',
        'Output format requirements (MUST follow):',
        '- Markdown format.',
        '- First line MUST be: # <Title>',
        '- Followed by detailed description with steps and acceptance criteria.',
        '- No meta-explanation, only the ticket content.',
        '- Do not edit or create files.',
        '- Respond only with the ticket Markdown content, no additional commentary.',
    ].join('\n')

    const extra = (appendPrompt ?? '').trim()

    // If a custom prompt is provided, use it as the base instead of the default
    if (input.customPrompt) {
        const customBase = input.customPrompt.trim()
        // Ensure proper separation between sections with double newlines
        const fullPrompt = customBase + '\n' + inputContext + '\n' + outputFormat
        return extra ? `${fullPrompt}\n\n${extra}` : fullPrompt
    }

    const base = [
        'You are a ticket generator for a software project.',
        '',
        'Before writing the ticket, analyze the repository to understand project context:',
        '',
        '1. Scan repository structure:',
        '   - Check package.json, tsconfig.json, or equivalent config files',
        '   - Identify if this is a monorepo or single-package project',
        '   - Note the project name and any workspace packages',
        '',
        '2. Identify tech stack and frameworks:',
        '   - List primary language(s) and runtime (e.g., TypeScript, Bun, Node)',
        '   - Note frameworks in use (e.g., React, Hono, Vite)',
        '   - Identify testing tools and linters',
        '',
        '3. Analyze naming conventions and patterns:',
        '   - Check existing file and folder naming (kebab-case, camelCase, etc.)',
        '   - Look at how similar features are structured',
        '   - Note any patterns in existing tickets or documentation',
        '',
        '4. Check commit message conventions:',
        '   - Review recent commits for style (conventional commits, etc.)',
        '   - Note any prefixes or patterns used (feat:, fix:, etc.)',
        '',
        'Use this context to write a ticket that aligns with the project\'s conventions.',
        inputContext,
        '',
        'Task:',
        'Write an improved ticket that meets the following requirements:',
        '- Markdown.',
        '- First line: # <New title or unchanged title>.',
        '- Detailed description with steps and acceptance criteria.',
        '- Reference specific technologies, paths, and patterns discovered during analysis.',
        '- No meta-explanation, only the ticket content.',
        '- Do not edit or create files.',
        '- Respond only with the ticket Markdown content, no additional commentary or instructions.',
    ].join('\n')

    return extra ? `${base}\n\n${extra}` : base
}

export function buildPrSummaryPrompt(
    input: PrSummaryInlineInput,
    appendPrompt?: string | null,
): string {
    const commitSummary = (input.commitSummary ?? '').trim()
    const diffSummary = (input.diffSummary ?? '').trim()

    // Build the context part that will be appended to any prompt
    const contextParts: string[] = []
    contextParts.push('')
    contextParts.push('Repository context:')
    contextParts.push(`- Repository path: ${input.repositoryPath}`)
    contextParts.push(`- Base branch: ${input.baseBranch}`)
    contextParts.push(`- Head branch: ${input.headBranch}`)

    if (commitSummary || diffSummary) {
        contextParts.push('')
        contextParts.push('Summary of changes between base and head:')
        if (commitSummary) {
            contextParts.push('')
            contextParts.push('Commits (base..head):')
            contextParts.push(commitSummary)
        }
        if (diffSummary) {
            contextParts.push('')
            contextParts.push('Diff summary (files and stats):')
            contextParts.push(diffSummary)
        }
    }
    const contextBlock = contextParts.join('\n')

    // Output format requirements - always enforced
    const outputFormat = [
        '',
        'Output format requirements (MUST follow):',
        '- Markdown format.',
        '- First line MUST be: # <PR Title>',
        '- Summary section with **maximum 5 bulletpoints** (fewer is better if changes are simple).',
        '- Each bulletpoint must be **1-2 lines maximum**, concise and scannable.',
        '- Prioritize the **most impactful changes** - omit trivial or redundant items.',
        '- Use clear, actionable language (e.g., "Add", "Fix", "Update", "Remove").',
        '- No meta-explanation, only the PR body content.',
        '- Do not edit or create files.',
        '- Respond only with the PR Markdown content, no additional commentary.',
    ].join('\n')

    const extra = (appendPrompt ?? '').trim()

    // If a custom prompt is provided, use it as the base instead of the default
    if (input.customPrompt) {
        const customBase = input.customPrompt.trim()
        // Ensure proper separation between sections with double newlines
        const fullPrompt = customBase + '\n' + contextBlock + '\n' + outputFormat
        return extra ? `${fullPrompt}\n\n${extra}` : fullPrompt
    }

    const parts: string[] = []

    parts.push('You are a pull request generator for a software project.')
    parts.push(contextBlock)
    parts.push('')
    parts.push('Task:')
    parts.push('Write a pull request title and body that meet the following requirements:')
    parts.push('- Markdown.')
    parts.push('- First line: # <New title or unchanged title>.')
    parts.push('- Summary section with **maximum 5 bulletpoints** (fewer is better if changes are simple).')
    parts.push('- Each bulletpoint must be **1-2 lines maximum**, concise and scannable.')
    parts.push('- Prioritize the **most impactful changes** - omit trivial or redundant items.')
    parts.push('- Use clear, actionable language (e.g., "Add", "Fix", "Update", "Remove").')
    parts.push('- No meta-explanation, only the PR body content.')
    parts.push('- Do not edit or create files.')
    parts.push('- Respond only with the PR Markdown content, no additional commentary or instructions.')

    const base = parts.join('\n')
    return extra ? `${base}\n\n${extra}` : base
}
