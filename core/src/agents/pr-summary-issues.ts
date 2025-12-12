function normalizeIssueNumbers(issueNumbers: number[]): number[] {
    const unique = new Set<number>()
    for (const raw of issueNumbers) {
        const num = Number(raw)
        if (Number.isFinite(num) && num > 0) unique.add(num)
    }
    return Array.from(unique).sort((a, b) => a - b)
}

export type GithubIssueRef = {
    issueNumber: number
    owner?: string | null
    repo?: string | null
}

function normalizeIssueRefs(refs: GithubIssueRef[]): GithubIssueRef[] {
    const deduped = new Map<string, GithubIssueRef>()
    for (const ref of refs) {
        const num = Number(ref.issueNumber)
        if (!Number.isFinite(num) || num <= 0) continue
        const owner = typeof ref.owner === 'string' ? ref.owner.trim().toLowerCase() : ''
        const repo = typeof ref.repo === 'string' ? ref.repo.trim().toLowerCase() : ''
        const key = owner && repo ? `${owner}/${repo}#${num}` : `#${num}`
        if (!deduped.has(key)) {
            deduped.set(key, {issueNumber: num, owner: owner || undefined, repo: repo || undefined})
        }
    }
    return Array.from(deduped.values()).sort((a, b) => {
        const aOwner = a.owner ?? ''
        const bOwner = b.owner ?? ''
        if (aOwner !== bOwner) return aOwner.localeCompare(bOwner)
        const aRepo = a.repo ?? ''
        const bRepo = b.repo ?? ''
        if (aRepo !== bRepo) return aRepo.localeCompare(bRepo)
        return a.issueNumber - b.issueNumber
    })
}

function issueRefKey(ref: GithubIssueRef): string {
    const owner = typeof ref.owner === 'string' ? ref.owner.trim().toLowerCase() : ''
    const repo = typeof ref.repo === 'string' ? ref.repo.trim().toLowerCase() : ''
    return owner && repo ? `${owner}/${repo}#${ref.issueNumber}` : `#${ref.issueNumber}`
}

function formatIssueRef(ref: GithubIssueRef): string {
    const owner = typeof ref.owner === 'string' ? ref.owner.trim() : ''
    const repo = typeof ref.repo === 'string' ? ref.repo.trim() : ''
    if (owner && repo) return `${owner}/${repo}#${ref.issueNumber}`
    return `#${ref.issueNumber}`
}

export function buildGithubIssueAutoCloseLine(issueNumbers: number[]): string | null {
    return buildGithubIssueAutoCloseLineForRefs(
        normalizeIssueNumbers(issueNumbers).map((issueNumber) => ({issueNumber})),
    )
}

export function buildGithubIssueAutoCloseLineForRefs(refs: GithubIssueRef[]): string | null {
    const normalized = normalizeIssueRefs(refs)
    if (normalized.length === 0) return null
    if (normalized.length === 1) return `closes ${formatIssueRef(normalized[0]!)}`
    return normalized
        .map((ref, index) => `${index === 0 ? 'closes' : 'fixes'} ${formatIssueRef(ref)}`)
        .join(', ')
}

const AUTO_CLOSE_REGEX =
    /\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\b[\s:(]*(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#(\d+)\b/gi

function parseExistingAutoCloseRefs(body: string): Array<{key: string; number: number}> {
    const refs: Array<{key: string; number: number}> = []
    if (!body) return refs
    let match: RegExpExecArray | null
    while ((match = AUTO_CLOSE_REGEX.exec(body))) {
        const ownerRepoRaw = match[1]
        const numRaw = match[2]
        const num = Number(numRaw)
        if (!Number.isFinite(num) || num <= 0) continue
        const ownerRepo =
            typeof ownerRepoRaw === 'string' ? ownerRepoRaw.trim().toLowerCase() : ''
        const key = ownerRepo ? `${ownerRepo}#${num}` : `#${num}`
        refs.push({key, number: num})
    }
    return refs
}

export function extractGithubIssueAutoCloseRefs(body: string): Set<string> {
    const referenced = new Set<string>()
    for (const ref of parseExistingAutoCloseRefs(body)) referenced.add(ref.key)
    return referenced
}

export function extractGithubIssueAutoCloseNumbers(body: string): Set<number> {
    const referenced = new Set<number>()
    for (const ref of parseExistingAutoCloseRefs(body)) referenced.add(ref.number)
    return referenced
}

export function appendGithubIssueAutoCloseReferencesForRefs(
    body: string,
    refs: GithubIssueRef[],
    opts?: {compareByNumber?: boolean; targetRepo?: {owner: string; repo: string} | null},
): string {
    const normalized = normalizeIssueRefs(refs)
    if (normalized.length === 0) return body

    let missing: GithubIssueRef[]
    if (opts?.compareByNumber) {
        const existingNumbers = extractGithubIssueAutoCloseNumbers(body)
        missing = normalized.filter((ref) => !existingNumbers.has(ref.issueNumber))
    } else {
        const existingKeys = extractGithubIssueAutoCloseRefs(body)
        const targetOwner = opts?.targetRepo?.owner.trim().toLowerCase() || null
        const targetRepoName = opts?.targetRepo?.repo.trim().toLowerCase() || null
        const targetQualifiedPrefix = targetOwner && targetRepoName ? `${targetOwner}/${targetRepoName}#` : null

        missing = normalized.filter((ref) => {
            const key = issueRefKey(ref)
            if (existingKeys.has(key)) return false
            if (targetQualifiedPrefix && key.startsWith('#')) {
                const qualifiedKey = `${targetQualifiedPrefix}${ref.issueNumber}`
                if (existingKeys.has(qualifiedKey)) return false
            }
            return true
        })
    }

    if (missing.length === 0) return body

    const line = buildGithubIssueAutoCloseLineForRefs(missing)
    if (!line) return body

    const trimmedBody = body.trimEnd()
    if (!trimmedBody) return line
    return `${trimmedBody}\n\n${line}`
}

export function appendGithubIssueAutoCloseReferences(body: string, issueNumbers: number[]): string {
    return appendGithubIssueAutoCloseReferencesForRefs(
        body,
        normalizeIssueNumbers(issueNumbers).map((issueNumber) => ({issueNumber})),
        {compareByNumber: true},
    )
}
