import type {TicketEnhanceInput, TicketEnhanceResult} from './types'

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

export function buildTicketEnhancePrompt(input: TicketEnhanceInput, appendPrompt?: string | null): string {
    const description = input.description?.trim() || '(keine Beschreibung)'

    const base = [
        'Du bist ein Ticket-Generator für ein Softwareprojekt.',
        '',
        'Eingabe:',
        `Titel: ${input.title}`,
        'Beschreibung:',
        description,
        '',
        'Aufgabe:',
        'Formuliere ein verbessertes Ticket, das die folgenden Anforderungen erfüllt:',
        '- Markdown.',
        '- Erste Zeile: # <Neuer Titel oder unveränderter Titel>.',
        '- Detaillierte Beschreibung mit Schritten und Akzeptanzkriterien.',
        '- Mindestens ein ```mermaid``` Diagramm (graph oder sequenceDiagram).',
        '- Möglichst ein zusätzliches Sequenzdiagramm, falls sinnvoll.',
        '- Keine Meta-Erklärung, nur der Ticketinhalt.',
    ].join('\n')

    const extra = (appendPrompt ?? '').trim()
    return extra ? `${base}\n\n${extra}` : base
}
