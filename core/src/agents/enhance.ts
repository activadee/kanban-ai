import type {ProjectSummary} from 'shared'
import {projectsService} from '../projects/service'
import {ensureProjectSettings} from '../projects/settings/service'
import {getAgent} from './registry'
import type {Agent, TicketEnhanceInput, TicketEnhanceResult} from './types'
import {resolveAgentProfile} from './profile-resolution'

export type AgentEnhanceTicketOptions = {
    projectId: string
    boardId?: string
    title: string
    description: string
    agentKey?: string
    profileId?: string
    signal?: AbortSignal
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
        // Intentionally avoid logging here to keep orchestration pure.
        // Callers can decide how to surface warnings in the future.
    }
    return profile
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
    const boardId = resolveBoardId(opts, project)
    const agentKey = opts.agentKey || settings.defaultAgent || 'DROID'
    const profileId = opts.profileId || settings.defaultProfileId || null

    const agent = getAgent(agentKey)
    if (!agent) {
        throw new Error(`Unknown agent: ${agentKey}`)
    }
    if (!agent.enhance) {
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
        profileId,
        signal,
    }

    const profile = await resolveProfileForAgent(agent, opts.projectId, profileId)

    return agent.enhance(input, profile as any)
}

