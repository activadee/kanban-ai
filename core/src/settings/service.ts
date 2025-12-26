import type {
    AppSettings as SharedAppSettings,
    UpdateAppSettingsRequest,
} from "shared";
import {
    getAppSettingsRow,
    insertDefaultAppSettings,
    updateAppSettingsRow,
} from "./repo";

// Supported editor types - used to validate new values
const SUPPORTED_EDITORS = new Set([
    "VS_CODE",
    "VS_CODE_INSURANCE",
    "CURSOR",
    "WINDSCRAFT",
    "OPENVSP",
    "REA",
    "JETBRAINS",
    "NOVA",
    "SUBLIME",
    "TEXTMATE",
    "BBEDIT",
    "CODE",
    "ZEPHYR",
    "VSCodium",
    "VSCodium_Insiders",
] as const);

// Type alias for the literal values in SUPPORTED_EDITORS
type EditorTypeLiteral = typeof SUPPORTED_EDITORS extends Set<infer T> ? T : never;

let cache: SharedAppSettings | null = null;

function defaults(): SharedAppSettings {
    const now = new Date().toISOString();
    return {
        id: "singleton",
        theme: "system",
        language: "browser",
        telemetryEnabled: false,
        notificationsAgentCompletionSound: false,
        notificationsDesktop: false,
        autoStartAgentOnInProgress: false,
        editorType: "VS_CODE",
        editorCommand: null,
        gitUserName: null,
        gitUserEmail: null,
        branchTemplate: "{prefix}/{ticketKey}-{slug}",
        ghPrTitleTemplate: null,
        ghPrBodyTemplate: null,
        ghAutolinkTickets: true,
        opencodePort: 4097,
        createdAt: now,
        updatedAt: now,
    };
}

function toIso(v: Date | number | string | null | undefined): string {
    if (!v) return new Date().toISOString();
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
        ? new Date().toISOString()
        : d.toISOString();
}

/**
 * Normalize editor settings from database row.
 * For supported editors, command is set to null (uses executable discovery).
 * For legacy/unknown editors, preserves the original type and command.
 */
function normalizeEditor(
    rowType: unknown,
    rowCommand: unknown,
): {
    editorType: SharedAppSettings["editorType"];
    editorCommand: string | null;
} {
    const type = (rowType as string | undefined) ?? "VS_CODE";
    const cleanedCommand =
        typeof rowCommand === "string" && rowCommand.trim() ? rowCommand : null;

    // For supported editors, use executable discovery (command = null)
    if (SUPPORTED_EDITORS.has(type as EditorTypeLiteral)) {
        return {
            editorType: type as SharedAppSettings["editorType"],
            editorCommand: null,
        };
    }

    // For legacy or unknown editors, preserve original type and command
    return {
        editorType: type as SharedAppSettings["editorType"],
        editorCommand: cleanedCommand,
    };
}

function mapRow(row: any): SharedAppSettings {
    const { editorType, editorCommand } = normalizeEditor(
        row.editorType ?? row.editor_type,
        row.editorCommand ?? row.editor_command,
    );
    return {
        id: row.id,
        theme: (row.theme ?? "system") as SharedAppSettings["theme"],
        language: (row.language ?? "browser") as SharedAppSettings["language"],
        telemetryEnabled: Boolean(
            row.telemetryEnabled ?? row.telemetry_enabled ?? false,
        ),
        notificationsAgentCompletionSound: Boolean(
            row.notificationsAgentCompletionSound ??
                row.notificationsToastSounds ??
                row.notif_toast_sounds ??
                false,
        ),
        notificationsDesktop: Boolean(
            row.notificationsDesktop ?? row.notif_desktop ?? false,
        ),
        autoStartAgentOnInProgress: Boolean(
            row.autoStartAgentOnInProgress ??
                row.auto_start_agent_on_in_progress ??
                false,
        ),
        editorType,
        editorCommand,
        gitUserName: row.gitUserName ?? row.git_user_name ?? null,
        gitUserEmail: row.gitUserEmail ?? row.git_user_email ?? null,
        branchTemplate:
            row.branchTemplate ??
            row.branch_template ??
            "{prefix}/{ticketKey}-{slug}",
        ghPrTitleTemplate:
            row.ghPrTitleTemplate ?? row.gh_pr_title_template ?? null,
        ghPrBodyTemplate:
            row.ghPrBodyTemplate ?? row.gh_pr_body_template ?? null,
        ghAutolinkTickets: Boolean(
            row.ghAutolinkTickets ?? row.gh_autolink_tickets ?? true,
        ),
        opencodePort: Number(row.opencodePort ?? row.opencode_port ?? 4097),
        createdAt: toIso(row.createdAt ?? row.created_at),
        updatedAt: toIso(row.updatedAt ?? row.updated_at),
    };
}

export async function ensureAppSettings(): Promise<SharedAppSettings> {
    const existing = await getAppSettingsRow();
    if (existing) {
        cache = mapRow(existing);
        return cache;
    }
    await insertDefaultAppSettings();
    const created = await getAppSettingsRow();
    if (!created) throw new Error("Failed to initialize app settings");
    cache = mapRow(created);
    return cache;
}

export async function updateAppSettings(
    payload: UpdateAppSettingsRequest,
): Promise<SharedAppSettings> {
    const nn = (v: unknown) =>
        typeof v === "string"
            ? v.trim().length
                ? v
                : null
            : v === undefined
              ? undefined
              : (v as any);
    if (payload.opencodePort !== undefined) {
        if (!Number.isInteger(payload.opencodePort) || payload.opencodePort < 1 || payload.opencodePort > 65535) {
            throw new Error("Invalid port: must be an integer between 1 and 65535");
        }
    }
    const updates = {
        theme: payload.theme,
        language: payload.language,
        telemetryEnabled: payload.telemetryEnabled,
        notificationsAgentCompletionSound:
            payload.notificationsAgentCompletionSound,
        notificationsDesktop: payload.notificationsDesktop,
        autoStartAgentOnInProgress: payload.autoStartAgentOnInProgress,
        editorType: payload.editorType,
        editorCommand: nn(payload.editorCommand),
        gitUserName: nn(payload.gitUserName),
        gitUserEmail: nn(payload.gitUserEmail),
        branchTemplate: nn(payload.branchTemplate),
        ghPrTitleTemplate: nn(payload.ghPrTitleTemplate),
        ghPrBodyTemplate: nn(payload.ghPrBodyTemplate),
        ghAutolinkTickets: payload.ghAutolinkTickets,
        opencodePort: payload.opencodePort,
    };
    await updateAppSettingsRow(updates as any);
    cache = await ensureAppSettings();
    return cache;
}

export function getAppSettingsSnapshot(): SharedAppSettings {
    return cache ?? defaults();
}

export const settingsService = {
    ensure: ensureAppSettings,
    update: updateAppSettings,
    snapshot: getAppSettingsSnapshot,
};

export type SettingsService = typeof settingsService;
