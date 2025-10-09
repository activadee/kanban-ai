export function sanitizeTicketPrefix(input: string | null | undefined): string {
    const raw = (input ?? '').toString().trim().toUpperCase()
    const cleaned = raw.replace(/[^A-Z0-9]/g, '').slice(0, 6)
    return cleaned.length > 0 ? cleaned : 'PRJ'
}

export function deriveDefaultTicketPrefix(projectName: string): string {
    const candidates = projectName
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
    const joined = candidates.length ? candidates.map((w) => w[0]).join('') : 'PRJ'
    return sanitizeTicketPrefix(joined)
}

export function isValidTicketPrefix(prefix: string): boolean {
    return /^[A-Z0-9]{1,6}$/.test(prefix)
}

export function assertValidTicketPrefix(prefix: string): void {
    if (!isValidTicketPrefix(prefix)) throw new Error('Invalid ticket prefix')
}

export function formatTicketKey(prefix: string, number: number): string {
    return `${prefix}-${number}`
}

export function getDefaultPrefix(): string {
    return 'PRJ'
}

