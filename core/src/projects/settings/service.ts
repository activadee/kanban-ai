import type {ProjectSettings, UpdateProjectSettingsRequest} from 'shared'
import {withTx, type DbExecutor} from '../../db/with-tx'
import type {ProjectSettingsRow} from '../../db/schema/projects'
import {getBoardById} from '../repo'
import {getProjectSettingsRow, insertProjectSettings, updateProjectSettingsRow} from './repo'
import {deriveDefaultTicketPrefix, sanitizeTicketPrefix} from '../tickets/ticket-keys'

function mapRow(row: ProjectSettingsRow): ProjectSettings {
    const toIso = (v: Date | number | string) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString())
    return {
        projectId: row.projectId,
        boardId: row.projectId,
        baseBranch: row.baseBranch,
        preferredRemote: row.preferredRemote ?? null,
        setupScript: row.setupScript ?? null,
        devScript: row.devScript ?? null,
        cleanupScript: row.cleanupScript ?? null,
        copyFiles: row.copyFiles ?? null,
        defaultAgent: row.defaultAgent ?? null,
        defaultProfileId: row.defaultProfileId ?? null,
        autoCommitOnFinish: Boolean(row.autoCommitOnFinish),
        ticketPrefix: row.ticketPrefix,
        nextTicketNumber: row.nextTicketNumber,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

export async function ensureProjectSettings(projectId: string, executor?: DbExecutor): Promise<ProjectSettings> {
    const existing = await getProjectSettingsRow(projectId, executor)
    if (existing) return mapRow(existing)
    const board = await getBoardById(projectId, executor)
    if (!board) throw new Error('Project not found')
    const ticketPrefix = deriveDefaultTicketPrefix(board.name)
    const now = new Date()
    await insertProjectSettings(
        {
            projectId,
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            defaultAgent: null,
            defaultProfileId: null,
            autoCommitOnFinish: false,
            ticketPrefix,
            nextTicketNumber: 1,
            createdAt: now,
            updatedAt: now,
        },
        executor,
    )
    const created = await getProjectSettingsRow(projectId, executor)
    if (!created) throw new Error('Failed to initialize project settings')
    return mapRow(created)
}

export async function getProjectSettings(projectId: string, executor?: DbExecutor): Promise<ProjectSettings> {
    const row = await ensureProjectSettings(projectId, executor)
    return row
}

export async function updateProjectSettings(projectId: string, updates: UpdateProjectSettingsRequest, executor?: DbExecutor): Promise<ProjectSettings> {
    const patch: Partial<ProjectSettingsRow> = {}
    const nn = (v: unknown) => (typeof v === 'string' ? (v.trim() ? v : null) : v === undefined ? undefined : (v as any))
    if (updates.baseBranch !== undefined) patch.baseBranch = updates.baseBranch
    if (updates.preferredRemote !== undefined) patch.preferredRemote = nn(updates.preferredRemote)
    if (updates.setupScript !== undefined) patch.setupScript = nn(updates.setupScript)
    if (updates.devScript !== undefined) patch.devScript = nn(updates.devScript)
    if (updates.cleanupScript !== undefined) patch.cleanupScript = nn(updates.cleanupScript)
    if (updates.copyFiles !== undefined) patch.copyFiles = nn(updates.copyFiles)
    if (updates.defaultAgent !== undefined) patch.defaultAgent = nn(updates.defaultAgent)
    if (updates.defaultProfileId !== undefined) patch.defaultProfileId = nn(updates.defaultProfileId)
    if (updates.autoCommitOnFinish !== undefined) patch.autoCommitOnFinish = Boolean(updates.autoCommitOnFinish)
    if (updates.ticketPrefix !== undefined) patch.ticketPrefix = sanitizeTicketPrefix(updates.ticketPrefix)
    patch.updatedAt = new Date()
    await updateProjectSettingsRow(projectId, patch as any, executor)
    const row = await ensureProjectSettings(projectId, executor)
    return row
}

// Named exports already declared above; keep alias export minimal to avoid conflicts
export {ensureProjectSettings as ensure}
