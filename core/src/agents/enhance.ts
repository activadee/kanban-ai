import type {ProjectSummary, TicketType} from 'shared'
import {projectsService} from '../projects/service'
import {ensureProjectSettings} from '../projects/settings/service'
import {getAgent} from './registry'
import {runInlineTask} from './inline'
import type {
    Agent,
    InlineTaskContext,
    TicketEnhanceInput,
    TicketEnhanceResult,
} from './types'
import {resolveAgentProfile} from './profile-resolution'

export type AgentEnhanceTicketOptions = {
    projectId: string
    boardId?: string
    title: string
    description: string
    agentKey?: string
    profileId?: string
    signal?: AbortSignal
    ticketType?: TicketType | null
}

function resolveBoardId(opts: AgentEnhanceTicketOptions, project: ProjectSummary): string {
    return opts.boardId || project.boardId || project.id
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
        if (resolved.label) {
            // For now, surface profile selection only via logs in higher layers if needed.
            // The orchestrator stays side‑effect free apart from the enhance() call.
        }
    } else if (resolved.warning) {
        // Log soft failures when a configured profile is missing or invalid so
        // callers have observability while still falling back to defaults.
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

export async function agentEnhanceTicket(opts: AgentEnhanceTicketOptions): Promise<TicketEnhanceResult> {
    const project = await projectsService.get(opts.projectId)
    if (!project) {
        throw new Error('Project not found')
    }

    const settings = await ensureProjectSettings(opts.projectId)
    const inlineProfileMapping = settings.inlineAgentProfileMapping ?? {}
    const boardId = resolveBoardId(opts, project)
    const inlineAgentRaw =
        typeof settings.inlineAgent === 'string' ? settings.inlineAgent.trim() : ''
    const inlineAgentKey = inlineAgentRaw.length ? inlineAgentRaw : null

    const inlineProfileRaw =
        typeof settings.inlineProfileId === 'string' ? settings.inlineProfileId.trim() : ''
    const inlineProfileId = inlineProfileRaw.length ? inlineProfileRaw : null

    const explicitAgentRaw =
        typeof opts.agentKey === 'string' ? opts.agentKey.trim() : ''
    let agentKey = explicitAgentRaw.length ? explicitAgentRaw : null

    const explicitProfileRaw =
        typeof opts.profileId === 'string' ? opts.profileId.trim() : ''
    let profileId = explicitProfileRaw.length ? explicitProfileRaw : null

    const fallbackAgentKey = settings.defaultAgent || 'DROID'

    if (!agentKey) {
        agentKey = inlineAgentKey || fallbackAgentKey
    }

    if (!profileId) {
        const mapped = inlineProfileMapping.ticketEnhance
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
    if (!agent.inline) {
        throw new Error(`Agent ${agentKey} does not support ticket enhancement`)
    }

    const signal = createSignal(opts.signal)
    const input: TicketEnhanceInput = {
        projectId: opts.projectId,
        boardId,
        repositoryPath: project.repositoryPath,
        baseBranch: settings.baseBranch,
        title: opts.title,
        description: opts.description,
        ticketType: opts.ticketType ?? null,
        profileId,
        signal,
    }

    const profile = await resolveProfileForAgent(agent, opts.projectId, profileId)
    const profileSource = resolveInlineProfileSource(profile)
    const context: InlineTaskContext = {
        projectId: opts.projectId,
        boardId,
        repositoryPath: project.repositoryPath,
        baseBranch: settings.baseBranch,
        branchName: settings.baseBranch,
        ticketType: opts.ticketType ?? null,
        headCommit: null,
        agentKey,
        profileId,
        profileSource,
    }

    return runInlineTask({
        agentKey,
        kind: 'ticketEnhance',
        input,
        profile: profile as any,
        context,
        signal,
    })
}
