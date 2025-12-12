function normalizeIssueNumbers(issueNumbers: number[]): number[] {
    const unique = new Set<number>()
    for (const raw of issueNumbers) {
        const num = Number(raw)
        if (Number.isFinite(num) && num > 0) unique.add(num)
    }
    return Array.from(unique).sort((a, b) => a - b)
}

export function buildGithubIssueAutoCloseLine(issueNumbers: number[]): string | null {
    const normalized = normalizeIssueNumbers(issueNumbers)
    if (normalized.length === 0) return null
    if (normalized.length === 1) return `closes #${normalized[0]}`
    return normalized
        .map((num, index) => `${index === 0 ? 'closes' : 'fixes'} #${num}`)
        .join(', ')
}

export function extractGithubIssueAutoCloseNumbers(body: string): Set<number> {
    const referenced = new Set<number>()
    if (!body) return referenced
    const regex = /\b(?:close[sd]?|fixe[sd]?|resolve[sd]?)\s+#(\d+)\b/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(body))) {
        const num = Number(match[1])
        if (Number.isFinite(num) && num > 0) referenced.add(num)
    }
    return referenced
}

export function appendGithubIssueAutoCloseReferences(body: string, issueNumbers: number[]): string {
    const normalized = normalizeIssueNumbers(issueNumbers)
    if (normalized.length === 0) return body

    const existing = extractGithubIssueAutoCloseNumbers(body)
    const missing = normalized.filter((num) => !existing.has(num))
    if (missing.length === 0) return body

    const line = buildGithubIssueAutoCloseLine(missing)
    if (!line) return body

    const trimmedBody = body.trimEnd()
    if (!trimmedBody) return line
    return `${trimmedBody}\n\n${line}`
}
