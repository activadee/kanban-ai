import type {AppSettings as SharedAppSettings, UpdateAppSettingsRequest} from 'shared'
import {getAppSettingsRow, insertDefaultAppSettings, updateAppSettingsRow} from './repo'

let cache: SharedAppSettings | null = null

function defaults(): SharedAppSettings {
    const now = new Date().toISOString()
    return {
        id: 'singleton',
        theme: 'system',
        language: 'browser',
        telemetryEnabled: false,
        notificationsAgentCompletionSound: false,
        notificationsDesktop: false,
        editorType: 'VS_CODE',
        editorCommand: null,
        gitUserName: null,
        gitUserEmail: null,
        branchTemplate: '{prefix}/{ticketKey}-{slug}',
        ghPrTitleTemplate: null,
        ghPrBodyTemplate: null,
        ghAutolinkTickets: true,
        createdAt: now,
        updatedAt: now,
    }
}

function toIso(v: Date | number | string | null | undefined): string {
    if (!v) return new Date().toISOString()
    const d = v instanceof Date ? v : new Date(v)
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

const SUPPORTED_EDITORS = new Set<SharedAppSettings['editorType']>(['VS_CODE', 'WEBSTORM', 'ZED'])

function normalizeEditor(rowType: unknown, rowCommand: unknown): {
    editorType: SharedAppSettings['editorType']
    editorCommand: string | null
} {
    const type = (rowType as string | undefined) ?? 'VS_CODE'
    const cleanedCommand = typeof rowCommand === 'string' && rowCommand.trim() ? rowCommand : null
    if (SUPPORTED_EDITORS.has(type as SharedAppSettings['editorType'])) {
        return {
            editorType: type as SharedAppSettings['editorType'],
            editorCommand: cleanedCommand,
        }
    }
    // Legacy or unknown editors are coerced to default type but preserve any stored custom command
    return {editorType: 'VS_CODE', editorCommand: cleanedCommand}
}

function mapRow(row: any): SharedAppSettings {
    const {editorType, editorCommand} = normalizeEditor(row.editorType ?? row.editor_type, row.editorCommand ?? row.editor_command)
    return {
        id: row.id,
        theme: (row.theme ?? 'system') as SharedAppSettings['theme'],
        language: (row.language ?? 'browser') as SharedAppSettings['language'],
        telemetryEnabled: Boolean(row.telemetryEnabled ?? row.telemetry_enabled ?? false),
        notificationsAgentCompletionSound: Boolean(
            row.notificationsAgentCompletionSound ??
            row.notificationsToastSounds ??
            row.notif_toast_sounds ??
            false,
        ),
        notificationsDesktop: Boolean(row.notificationsDesktop ?? row.notif_desktop ?? false),
        editorType,
        editorCommand,
        gitUserName: row.gitUserName ?? row.git_user_name ?? null,
        gitUserEmail: row.gitUserEmail ?? row.git_user_email ?? null,
        branchTemplate: row.branchTemplate ?? row.branch_template ?? '{prefix}/{ticketKey}-{slug}',
        ghPrTitleTemplate: row.ghPrTitleTemplate ?? row.gh_pr_title_template ?? null,
        ghPrBodyTemplate: row.ghPrBodyTemplate ?? row.gh_pr_body_template ?? null,
        ghAutolinkTickets: Boolean(row.ghAutolinkTickets ?? row.gh_autolink_tickets ?? true),
        createdAt: toIso(row.createdAt ?? row.created_at),
        updatedAt: toIso(row.updatedAt ?? row.updated_at),
    }
}

export async function ensureAppSettings(): Promise<SharedAppSettings> {
    const existing = await getAppSettingsRow()
    if (existing) {
        cache = mapRow(existing)
        return cache
    }
    await insertDefaultAppSettings()
    const created = await getAppSettingsRow()
    if (!created) throw new Error('Failed to initialize app settings')
    cache = mapRow(created)
    return cache
}

export async function updateAppSettings(payload: UpdateAppSettingsRequest): Promise<SharedAppSettings> {
    const nn = (v: unknown) => (typeof v === 'string' ? (v.trim().length ? v : null) : v === undefined ? undefined : (v as any))
    const updates = {
        theme: payload.theme,
        language: payload.language,
        telemetryEnabled: payload.telemetryEnabled,
        notificationsAgentCompletionSound: payload.notificationsAgentCompletionSound,
        notificationsDesktop: payload.notificationsDesktop,
        editorType: payload.editorType,
        editorCommand: nn(payload.editorCommand),
        gitUserName: nn(payload.gitUserName),
        gitUserEmail: nn(payload.gitUserEmail),
        branchTemplate: nn(payload.branchTemplate),
        ghPrTitleTemplate: nn(payload.ghPrTitleTemplate),
        ghPrBodyTemplate: nn(payload.ghPrBodyTemplate),
        ghAutolinkTickets: payload.ghAutolinkTickets,
    }
    await updateAppSettingsRow(updates as any)
    cache = await ensureAppSettings()
    return cache
}

export function getAppSettingsSnapshot(): SharedAppSettings {
    return cache ?? defaults()
}

export const settingsService = {
    ensure: ensureAppSettings,
    update: updateAppSettings,
    snapshot: getAppSettingsSnapshot,
}
