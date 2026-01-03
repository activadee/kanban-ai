import type {
    InlineAgentProfileMapping,
    ProjectSettings,
    UpdateProjectSettingsRequest,
} from "shared";
import type { ProjectSettingsRow } from "../../db/types";
import { getBoardById } from "../repo";
import {
    getProjectSettingsRow,
    insertProjectSettings,
    updateProjectSettingsRow,
} from "./repo";
import {
    deriveDefaultTicketPrefix,
    sanitizeTicketPrefix,
} from "../tickets/ticket-keys";
import {
    DEFAULT_GITHUB_SYNC_INTERVAL_MINUTES,
    normalizeGithubIssueSyncInterval,
    type GithubIssueSyncStatus,
} from "./github-sync";

function normalizeDate(
    value: Date | number | string | null | undefined,
): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;

    // Drizzle sometimes stores timestamps as seconds; detect and upscale.
    if (typeof value === "number" && value > 0 && value < 1_000_000_000_000) {
        const secondsAsMs = value * 1000;
        return new Date(secondsAsMs);
    }

    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(value: Date | number | string | null | undefined): string {
    const normalized = normalizeDate(value) ?? new Date();
    return normalized.toISOString();
}

function toNullableIso(
    value: Date | number | string | null | undefined,
): string | null {
    const normalized = normalizeDate(value);
    return normalized ? normalized.toISOString() : null;
}

function parseInlineAgentProfileMapping(
    value: string | null | undefined,
): InlineAgentProfileMapping {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        const entries = Object.entries(parsed);
        const mapping: InlineAgentProfileMapping = {};
        for (const [key, raw] of entries) {
            if (
                key === "ticketEnhance" ||
                key === "prSummary" ||
                key === "prReview"
            ) {
                if (typeof raw === "string") {
                    const trimmed = raw.trim();
                    if (trimmed) {
                        mapping[key] = trimmed;
                        continue;
                    }
                }
                if (raw === null) {
                    mapping[key] = null;
                }
            }
        }
        return mapping;
    } catch {
        return {};
    }
}

function mapRow(row: ProjectSettingsRow): ProjectSettings {
    const normalizeStatus = (
        status: string | null | undefined,
    ): GithubIssueSyncStatus => {
        if (
            status === "running" ||
            status === "succeeded" ||
            status === "failed"
        )
            return status;
        return "idle";
    };

    const intervalMinutes =
        typeof row.githubIssueSyncIntervalMinutes === "number"
            ? normalizeGithubIssueSyncInterval(
                  row.githubIssueSyncIntervalMinutes,
              )
            : DEFAULT_GITHUB_SYNC_INTERVAL_MINUTES;

    return {
        projectId: row.projectId,
        boardId: row.projectId,
        baseBranch: row.baseBranch,
        preferredRemote: row.preferredRemote ?? null,
        setupScript: row.setupScript ?? null,
        devScript: row.devScript ?? null,
        cleanupScript: row.cleanupScript ?? null,
        copyFiles: row.copyFiles ?? null,
        allowScriptsToFail: Boolean(row.allowScriptsToFail),
        allowCopyFilesToFail: Boolean(row.allowCopyFilesToFail),
        allowSetupScriptToFail: Boolean(row.allowSetupScriptToFail),
        allowDevScriptToFail: Boolean(row.allowDevScriptToFail),
        allowCleanupScriptToFail: Boolean(row.allowCleanupScriptToFail),
        defaultAgent: row.defaultAgent ?? null,
        defaultProfileId: row.defaultProfileId ?? null,
        inlineAgent: row.inlineAgent ?? null,
        inlineProfileId: row.inlineProfileId ?? null,
        inlineAgentProfileMapping: parseInlineAgentProfileMapping(
            row.inlineAgentProfileMappingJson,
        ),
        autoCommitOnFinish: Boolean(row.autoCommitOnFinish),
        autoPushOnAutocommit: Boolean(row.autoPushOnAutocommit),
        ticketPrefix: row.ticketPrefix,
        nextTicketNumber: row.nextTicketNumber,
        githubIssueSyncEnabled: Boolean(row.githubIssueSyncEnabled),
        githubIssueSyncState:
            (row.githubIssueSyncState as "open" | "all" | "closed") ?? "open",
        githubIssueSyncIntervalMinutes: intervalMinutes,
        githubIssueAutoCreateEnabled: Boolean(row.githubIssueAutoCreateEnabled),
        autoCloseTicketOnPRMerge: Boolean(row.autoCloseTicketOnPRMerge),
        lastGithubPrAutoCloseAt: toNullableIso(row.lastGithubPrAutoCloseAt),
        lastGithubPrAutoCloseStatus: normalizeStatus(
            row.lastGithubPrAutoCloseStatus,
        ),
        lastGithubIssueSyncAt: toNullableIso(row.lastGithubIssueSyncAt),
        lastGithubIssueSyncStatus: normalizeStatus(
            row.lastGithubIssueSyncStatus,
        ),
        enhancePrompt: row.enhancePrompt ?? null,
        prSummaryPrompt: row.prSummaryPrompt ?? null,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    };
}

export async function ensureProjectSettings(
    projectId: string,
): Promise<ProjectSettings> {
    const existing = await getProjectSettingsRow(projectId);
    if (existing) return mapRow(existing);
    const board = await getBoardById(projectId);
    if (!board) throw new Error("Project not found");
    const ticketPrefix = deriveDefaultTicketPrefix(board.name);
    const now = new Date();
    await insertProjectSettings({
        projectId,
        baseBranch: "main",
        preferredRemote: null,
        setupScript: null,
        devScript: null,
        cleanupScript: null,
        copyFiles: null,
        allowScriptsToFail: false,
        allowCopyFilesToFail: false,
        allowSetupScriptToFail: false,
        allowDevScriptToFail: false,
        allowCleanupScriptToFail: false,
        defaultAgent: null,
        defaultProfileId: null,
        inlineAgent: null,
        inlineProfileId: null,
        inlineAgentProfileMappingJson: JSON.stringify({}),
        autoCommitOnFinish: false,
        autoPushOnAutocommit: false,
        ticketPrefix,
        nextTicketNumber: 1,
        githubIssueSyncEnabled: false,
        githubIssueSyncState: "open",
        githubIssueSyncIntervalMinutes:
            DEFAULT_GITHUB_SYNC_INTERVAL_MINUTES,
        githubIssueAutoCreateEnabled: false,
        autoCloseTicketOnPRMerge: false,
        lastGithubPrAutoCloseAt: null,
        lastGithubPrAutoCloseStatus: "idle",
        lastGithubIssueSyncAt: null,
        lastGithubIssueSyncStatus: "idle",
        enhancePrompt: null,
        prSummaryPrompt: null,
        createdAt: now,
        updatedAt: now,
    });
    const created = await getProjectSettingsRow(projectId);
    if (!created) throw new Error("Failed to initialize project settings");
    return mapRow(created);
}

export async function getProjectSettings(
    projectId: string,
): Promise<ProjectSettings> {
    const row = await ensureProjectSettings(projectId);
    return row;
}

export async function updateProjectSettings(
    projectId: string,
    updates: UpdateProjectSettingsRequest,
): Promise<ProjectSettings> {
    const patch: Partial<ProjectSettingsRow> = {};
    const nn = (v: unknown) =>
        typeof v === "string"
            ? v.trim()
                ? v
                : null
            : v === undefined
              ? undefined
              : (v as string | number | boolean | null);
    if (updates.baseBranch !== undefined) patch.baseBranch = updates.baseBranch;
    if (updates.preferredRemote !== undefined)
        patch.preferredRemote = nn(updates.preferredRemote) as string | null;
    if (updates.setupScript !== undefined)
        patch.setupScript = nn(updates.setupScript) as string | null;
    if (updates.devScript !== undefined)
        patch.devScript = nn(updates.devScript) as string | null;
    if (updates.cleanupScript !== undefined)
        patch.cleanupScript = nn(updates.cleanupScript) as string | null;
    if (updates.copyFiles !== undefined)
        patch.copyFiles = nn(updates.copyFiles) as string | null;
    if (updates.allowScriptsToFail !== undefined)
        patch.allowScriptsToFail = Boolean(updates.allowScriptsToFail);
    if (updates.allowCopyFilesToFail !== undefined)
        patch.allowCopyFilesToFail = Boolean(updates.allowCopyFilesToFail);
    if (updates.allowSetupScriptToFail !== undefined)
        patch.allowSetupScriptToFail = Boolean(updates.allowSetupScriptToFail);
    if (updates.allowDevScriptToFail !== undefined)
        patch.allowDevScriptToFail = Boolean(updates.allowDevScriptToFail);
    if (updates.allowCleanupScriptToFail !== undefined)
        patch.allowCleanupScriptToFail = Boolean(updates.allowCleanupScriptToFail);
    if (updates.defaultAgent !== undefined)
        patch.defaultAgent = nn(updates.defaultAgent) as string | null;
    if (updates.defaultProfileId !== undefined)
        patch.defaultProfileId = nn(updates.defaultProfileId) as string | null;
    if (updates.inlineAgent !== undefined)
        patch.inlineAgent = nn(updates.inlineAgent) as string | null;
    if (updates.inlineProfileId !== undefined)
        patch.inlineProfileId = nn(updates.inlineProfileId) as string | null;
    if (updates.inlineAgentProfileMapping !== undefined) {
        const mapping = updates.inlineAgentProfileMapping ?? {};
        patch.inlineAgentProfileMappingJson = JSON.stringify(mapping);
    }
    if (updates.autoCommitOnFinish !== undefined)
        patch.autoCommitOnFinish = Boolean(updates.autoCommitOnFinish);
    if (updates.autoPushOnAutocommit !== undefined)
        patch.autoPushOnAutocommit = Boolean(updates.autoPushOnAutocommit);
    if (updates.ticketPrefix !== undefined)
        patch.ticketPrefix = sanitizeTicketPrefix(updates.ticketPrefix);
    if (updates.githubIssueSyncEnabled !== undefined) {
        patch.githubIssueSyncEnabled = Boolean(updates.githubIssueSyncEnabled);
    }
    if (updates.githubIssueSyncState !== undefined) {
        patch.githubIssueSyncState = updates.githubIssueSyncState;
    }
    if (updates.githubIssueSyncIntervalMinutes !== undefined) {
        patch.githubIssueSyncIntervalMinutes = normalizeGithubIssueSyncInterval(
            updates.githubIssueSyncIntervalMinutes,
        );
    }
    if (updates.githubIssueAutoCreateEnabled !== undefined) {
        patch.githubIssueAutoCreateEnabled = Boolean(updates.githubIssueAutoCreateEnabled);
    }
    if (updates.autoCloseTicketOnPRMerge !== undefined) {
        patch.autoCloseTicketOnPRMerge = Boolean(updates.autoCloseTicketOnPRMerge);
    }
    if (updates.enhancePrompt !== undefined) {
        patch.enhancePrompt = nn(updates.enhancePrompt) as string | null;
    }
    if (updates.prSummaryPrompt !== undefined) {
        patch.prSummaryPrompt = nn(updates.prSummaryPrompt) as string | null;
    }
    patch.updatedAt = new Date();
    await updateProjectSettingsRow(projectId, patch);
    const row = await ensureProjectSettings(projectId);
    return row;
}

// Named exports already declared above; keep alias export minimal to avoid conflicts
export { ensureProjectSettings as ensure };
