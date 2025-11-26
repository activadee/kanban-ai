import type {Agent} from '../agents/types'
import {getAgentProfile as getProjectAgentProfile} from '../agents/profiles'
import {getGlobalAgentProfile} from '../agents/profiles-global'

export type ResolvedAgentProfile<P> = {
    profile: P | null
    label?: string
    warning?: string
}

export async function resolveAgentProfile<P>(
    agent: Agent<P>,
    projectId: string,
    profileId?: string,
): Promise<ResolvedAgentProfile<P>> {
    if (!profileId) return {profile: null}

    const isGlobal = profileId.startsWith('apg-')
    const row = isGlobal
        ? await getGlobalAgentProfile(profileId)
        : await getProjectAgentProfile(projectId, profileId)

    if (!row) {
        return {
            profile: null,
            warning: `[profiles] ${isGlobal ? 'global' : 'project'} profile ${profileId} not found; falling back to defaults`,
        }
    }

    if (row.agent !== agent.key) {
        return {
            profile: null,
            warning: `[profiles] profile ${profileId} belongs to agent ${row.agent}; expected ${agent.key}. Using default profile instead`,
        }
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(row.configJson)
    } catch (err) {
        return {
            profile: null,
            warning: `[profiles] failed to parse profile ${profileId}: ${err instanceof Error ? err.message : String(err)}`,
        }
    }

    const validated = agent.profileSchema.safeParse(parsed)
    if (!validated.success) {
        const issue = validated.error.issues.at(0)?.message ?? 'invalid profile'
        return {
            profile: null,
            warning: `[profiles] profile ${profileId} is invalid: ${issue}. Using defaults`,
        }
    }

    return {profile: validated.data, label: row.name}
}

