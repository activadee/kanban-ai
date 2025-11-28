import type {TicketEnhanceResult} from './types'

export function splitTicketMarkdown(
    markdown: string,
    fallbackTitle: string,
    fallbackDescription: string,
): TicketEnhanceResult {
    const normalized = markdown.replace(/\r\n/g, '\n')
    const lines = normalized.split('\n')

    let headingIndex = -1
    let headingText = ''

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        const trimmedStart = line.trimStart()
        if (trimmedStart.startsWith('# ')) {
            headingIndex = i
            headingText = trimmedStart.slice(2).trim()
            break
        }
    }

    if (headingIndex === -1 || !headingText) {
        return {title: fallbackTitle, description: fallbackDescription}
    }

    const rest = lines.slice(headingIndex + 1).join('\n').trim()
    const description = rest || fallbackDescription

    return {
        title: headingText,
        description,
    }
}
