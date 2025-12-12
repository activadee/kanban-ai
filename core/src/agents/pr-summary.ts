import type {ProjectSummary} from 'shared'

import {projectsService} from '../projects/service'
import {ensureProjectSettings} from '../projects/settings/service'
import {getPrDiffSummary} from '../git/service'
import {listGithubIssueMappingsByCardId} from '../github/repo'
import {getAttemptById} from '../attempts/repo'
import {getAgent} from './registry'
import {runInlineTask} from './inline'
import type {
    Agent,
    InlineTaskContext,
    PrSummaryInlineInput,
    PrSummaryInlineResult,
} from './types'
import {resolveAgentProfile} from './profile-resolution'
import {appendGithubIssueAutoCloseReferences} from './pr-summary-issues'

export type AgentSummarizePullRequestOptions = {
    projectId: string
    baseBranch?: string
    headBranch: string
    agentKey?: string
    profileId?: string
    attemptId?: string
    cardId?: string
    signal?: AbortSignal
}

function resolveBoardId(project: ProjectSummary): string {
    return project.boardId || project.id
}

async function resolveProfileForAgent<P>(
    agent: Agent<P>,
    projectId: string,
    profileId: string | null,
): Promise<P> {
    let profile: P = agent.defaultProfile
    if (!profileId) return profile

    const resolved = await resolveAgentProfile(agent, projectId, profileId)
    if (resolved.profile !== null && resolved.profile !== undefined) {
        profile = resolved.profile
    } else if (resolved.warning) {
        // eslint-disable-next-line no-console
        console.warn(resolved.warning)
    }
    return profile
}

function resolveInlineProfileSource(profile: unknown): 'inline' | 'primary' {
    if (!profile || typeof profile !== 'object') return 'primary'
    const record = profile as Record<string, unknown>
    const inline = typeof record.inlineProfile === 'string' ? record.inlineProfile.trim() : ''
    if (inline.length > 0) return 'inline'
    return 'primary'
}

function createSignal(source?: AbortSignal): AbortSignal {
    if (!source) return new AbortController().signal
    const controller = new AbortController()
    const onAbort = () => controller.abort('caller aborted')
    if (source.aborted) {
        onAbort()
    } else {
        source.addEventListener('abort', onAbort, {once: true})
    }
    return controller.signal
}

async function resolveAssociatedCardIds(opts: AgentSummarizePullRequestOptions): Promise<string[]> {
    const cardIds = new Set<string>()
    const directCardId = typeof opts.cardId === 'string' ? opts.cardId.trim() : ''
    if (directCardId) cardIds.add(directCardId)

    const attemptId = typeof opts.attemptId === 'string' ? opts.attemptId.trim() : ''
    if (attemptId) {
        try {
            const attempt = await getAttemptById(attemptId)
            const attemptCardId = attempt?.cardId?.trim?.() || attempt?.cardId
            if (typeof attemptCardId === 'string' && attemptCardId.trim()) {
                cardIds.add(attemptCardId.trim())
            }
        } catch {
        }
    }

    return Array.from(cardIds)
}

async function resolveGithubIssueNumbers(cardIds: string[]): Promise<number[]> {
    const issueNumbers = new Set<number>()
    for (const cardId of cardIds) {
        try {
            const mappings = await listGithubIssueMappingsByCardId(cardId)
            for (const mapping of mappings as Array<{issueNumber?: unknown}>) {
                const num = Number(mapping.issueNumber)
                if (Number.isFinite(num) && num > 0) issueNumbers.add(num)
            }
        } catch {
        }
    }
    return Array.from(issueNumbers).sort((a, b) => a - b)
}

export async function agentSummarizePullRequest(
    opts: AgentSummarizePullRequestOptions,
): Promise<PrSummaryInlineResult> {
    const project = await projectsService.get(opts.projectId)
    if (!project) {
        throw new Error('Project not found')
    }

    const settings = await ensureProjectSettings(opts.projectId)
    const inlineProfileMapping = settings.inlineAgentProfileMapping ?? {}
    const boardId = resolveBoardId(project)

    const inlineAgentRaw =
        typeof settings.inlineAgent === 'string' ? settings.inlineAgent.trim() : ''
    const inlineAgentKey = inlineAgentRaw.length ? inlineAgentRaw : null

    const inlineProfileRaw =
        typeof settings.inlineProfileId === 'string' ? settings.inlineProfileId.trim() : ''
    const inlineProfileId = inlineProfileRaw.length ? inlineProfileRaw : null

    const explicitAgentRaw = typeof opts.agentKey === 'string' ? opts.agentKey.trim() : ''
    let agentKey = explicitAgentRaw.length ? explicitAgentRaw : null

    const explicitProfileRaw =
        typeof opts.profileId === 'string' ? opts.profileId.trim() : ''
    let profileId = explicitProfileRaw.length ? explicitProfileRaw : null

    const fallbackAgentKey = settings.defaultAgent || 'DROID'

    if (!agentKey) {
        agentKey = inlineAgentKey || fallbackAgentKey
    }

    if (!profileId) {
        const mapped = inlineProfileMapping.prSummary
        if (typeof mapped === 'string') {
            const trimmed = mapped.trim()
            if (trimmed) {
                profileId = trimmed
            }
        }
    }

    if (!profileId && inlineProfileId && inlineAgentKey && agentKey === inlineAgentKey) {
        profileId = inlineProfileId
    } else if (!profileId && settings.defaultProfileId) {
        const defaultProfileRaw =
            typeof settings.defaultProfileId === 'string'
                ? settings.defaultProfileId.trim()
                : settings.defaultProfileId
        if (defaultProfileRaw && (!inlineProfileId || inlineAgentKey !== agentKey)) {
            profileId = defaultProfileRaw
        }
    }

    const agent = getAgent(agentKey)
    if (!agent) {
        throw new Error(`Unknown agent: ${agentKey}`)
    }

    const headBranch = opts.headBranch.trim()
    if (!headBranch) {
        throw new Error('Head branch is required')
    }
    const baseBranch = (opts.baseBranch?.trim() || settings.baseBranch).trim()

    const signal = createSignal(opts.signal)

    let commitSummary: string | undefined
    let diffSummary: string | undefined
    try {
        const summary = await getPrDiffSummary(opts.projectId, baseBranch, headBranch)
        if (summary) {
            if (summary.commitSummary && summary.commitSummary.trim().length > 0) {
                commitSummary = summary.commitSummary.trim()
            }
            if (summary.diffSummary && summary.diffSummary.trim().length > 0) {
                diffSummary = summary.diffSummary.trim()
            }
        }
    } catch {
        // Best-effort: if git summary fails, proceed without diff context.
    }

    const input: PrSummaryInlineInput = {
        repositoryPath: project.repositoryPath,
        baseBranch,
        headBranch,
        commitSummary,
        diffSummary,
    }

    const profile = await resolveProfileForAgent(agent, opts.projectId, profileId)
    const profileSource = resolveInlineProfileSource(profile)

    const context: InlineTaskContext = {
        projectId: opts.projectId,
        boardId,
        repositoryPath: project.repositoryPath,
        baseBranch,
        branchName: headBranch,
        headCommit: null,
        agentKey,
        profileId,
        profileSource,
    }

    const summary = await runInlineTask({
        agentKey,
        kind: 'prSummary',
        input,
        profile: profile as any,
        context,
        signal,
    })

    const cardIds = await resolveAssociatedCardIds(opts)
    if (cardIds.length === 0) return summary

    const issueNumbers = await resolveGithubIssueNumbers(cardIds)
    if (issueNumbers.length === 0) return summary

    const body = appendGithubIssueAutoCloseReferences(summary.body, issueNumbers)
    if (body === summary.body) return summary
    return {...summary, body}
}
