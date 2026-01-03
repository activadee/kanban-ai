import type {ProjectSummary} from 'shared'

import {projectsService} from '../projects/service'
import {ensureProjectSettings} from '../projects/settings/service'
import {getPrDiffSummary} from '../git/service'
import {getGitOriginUrl, parseGithubOwnerRepo} from '../fs/git'
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
import {
    appendGithubIssueAutoCloseReferencesForRefs,
    type GithubIssueRef,
} from './pr-summary-issues'

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

async function resolveProjectGithubOwnerRepo(project: ProjectSummary): Promise<{owner: string; repo: string} | null> {
    const originUrl = await getGitOriginUrl(project.repositoryPath)
    if (originUrl) {
        const parsed = parseGithubOwnerRepo(originUrl)
        if (parsed) return parsed
    }

    const repoUrl =
        typeof project.repositoryUrl === 'string' ? project.repositoryUrl.trim() : ''
    if (repoUrl) {
        const parsed = parseGithubOwnerRepo(repoUrl)
        if (parsed) return parsed
    }

    return null
}

async function resolveAssociatedCardIds(opts: AgentSummarizePullRequestOptions): Promise<string[]> {
    const directCardId = typeof opts.cardId === 'string' ? opts.cardId.trim() : ''
    const attemptId = typeof opts.attemptId === 'string' ? opts.attemptId.trim() : ''

    if (directCardId) {
        if (attemptId) {
            try {
                const attempt = await getAttemptById(attemptId)
                const attemptCardId = attempt?.cardId?.trim?.() || attempt?.cardId
                const attemptCardIdTrimmed =
                    typeof attemptCardId === 'string' ? attemptCardId.trim() : ''
                if (attemptCardIdTrimmed && attemptCardIdTrimmed !== directCardId) {
                    console.warn('[agents:prSummary] attemptId/cardId mismatch; using explicit cardId', {
                        attemptId,
                        attemptCardId: attemptCardIdTrimmed,
                        cardId: directCardId,
                    })
                }
            } catch (err) {
                console.warn('[agents:prSummary] Failed to resolve attempt cardId', {attemptId, err})
            }
        }
        return [directCardId]
    }

    if (!attemptId) return []
    try {
        const attempt = await getAttemptById(attemptId)
        const attemptCardId = attempt?.cardId?.trim?.() || attempt?.cardId
        const attemptCardIdTrimmed =
            typeof attemptCardId === 'string' ? attemptCardId.trim() : ''
        return attemptCardIdTrimmed ? [attemptCardIdTrimmed] : []
    } catch (err) {
        console.warn('[agents:prSummary] Failed to resolve attempt cardId', {attemptId, err})
        return []
    }
}

async function resolveGithubIssueRefs(
    cardIds: string[],
    targetRepo: {owner: string; repo: string} | null,
): Promise<GithubIssueRef[]> {
    const refs: GithubIssueRef[] = []
    const targetOwner = targetRepo?.owner.trim().toLowerCase() || null
    const targetRepoName = targetRepo?.repo.trim().toLowerCase() || null
    const targetKnown = Boolean(targetOwner && targetRepoName)
    for (const cardId of cardIds) {
        try {
            const mappings = await listGithubIssueMappingsByCardId(cardId)
            for (const mapping of mappings as Array<{issueNumber?: unknown; owner?: unknown; repo?: unknown}>) {
                const num = Number(mapping.issueNumber)
                if (!Number.isFinite(num) || num <= 0) continue

                const owner =
                    typeof mapping.owner === 'string' ? mapping.owner.trim() : null
                const repo =
                    typeof mapping.repo === 'string' ? mapping.repo.trim() : null

                if (targetKnown) {
                    const ownerNorm = owner?.toLowerCase() || null
                    const repoNorm = repo?.toLowerCase() || null
                    if (ownerNorm && repoNorm && (ownerNorm !== targetOwner || repoNorm !== targetRepoName)) continue
                    refs.push({issueNumber: num})
                    continue
                }
                if (owner && repo) {
                    refs.push({issueNumber: num, owner, repo})
                }
            }
        } catch (err) {
            console.warn('[agents:prSummary] Failed to resolve GitHub issues for card', {cardId, err})
        }
    }
    return refs
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
        customPrompt: settings.prSummaryPrompt ?? null,
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

    const targetRepo = await resolveProjectGithubOwnerRepo(project)
    const issueRefs = await resolveGithubIssueRefs(cardIds, targetRepo)
    if (issueRefs.length === 0) return summary

    const body = appendGithubIssueAutoCloseReferencesForRefs(summary.body, issueRefs, {
        compareByNumber: false,
        targetRepo,
    })
    if (body === summary.body) return summary
    return {...summary, body}
}
