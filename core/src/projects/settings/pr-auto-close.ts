import {and, eq, ne, or, isNull, lt} from "drizzle-orm";
import type {ProjectSettings} from "shared";
import {projectSettings} from "../../db/schema";
import type {DbExecutor} from "../../db/with-tx";
import {resolveDb} from "../../db/with-tx";
import {
    MIN_GITHUB_SYNC_INTERVAL_MINUTES,
    normalizeGithubIssueSyncInterval,
} from "./github-sync";

export type GithubPrAutoCloseStatus =
    | "idle"
    | "running"
    | "succeeded"
    | "failed";

const STALE_RUNNING_THRESHOLD_MINUTES = 60;

export function isGithubPrAutoCloseEnabled(
    settings: ProjectSettings,
): boolean {
    if (!settings.autoCloseTicketOnPRMerge) return false;
    const interval = normalizeGithubIssueSyncInterval(
        settings.githubIssueSyncIntervalMinutes,
    );
    return interval >= MIN_GITHUB_SYNC_INTERVAL_MINUTES;
}

export function isGithubPrAutoCloseDue(
    settings: ProjectSettings,
    now: Date = new Date(),
): boolean {
    if (!isGithubPrAutoCloseEnabled(settings)) return false;
    const intervalMinutes = normalizeGithubIssueSyncInterval(
        settings.githubIssueSyncIntervalMinutes,
    );
    const lastAtStr = settings.lastGithubPrAutoCloseAt;
    if (!lastAtStr) return true;
    const lastAt = new Date(lastAtStr);
    if (Number.isNaN(lastAt.getTime())) return true;
    const elapsedMs = now.getTime() - lastAt.getTime();
    return elapsedMs >= intervalMinutes * 60 * 1000;
}

export async function tryStartGithubPrAutoClose(
    projectId: string,
    now: Date = new Date(),
    executor?: DbExecutor,
): Promise<boolean> {
    const db = resolveDb(executor);
    const staleCutoff = new Date(
        now.getTime() -
            STALE_RUNNING_THRESHOLD_MINUTES * 60 * 1000,
    );
    const result = await db
        .update(projectSettings)
        .set({
            lastGithubPrAutoCloseAt: now,
            lastGithubPrAutoCloseStatus: "running",
            updatedAt: now,
        })
        .where(
            and(
                eq(projectSettings.projectId, projectId),
                or(
                    ne(projectSettings.lastGithubPrAutoCloseStatus, "running"),
                    isNull(projectSettings.lastGithubPrAutoCloseAt),
                    lt(
                        projectSettings.lastGithubPrAutoCloseAt,
                        staleCutoff,
                    ),
                ),
            ),
        )
        .run();
    const changes =
        (result as any)?.changes ??
        (result as any)?.rowsAffected ??
        0;
    return changes > 0;
}

export async function completeGithubPrAutoClose(
    projectId: string,
    status: Exclude<GithubPrAutoCloseStatus, "running">,
    now: Date = new Date(),
    executor?: DbExecutor,
): Promise<void> {
    const db = resolveDb(executor);
    await db
        .update(projectSettings)
        .set({
            lastGithubPrAutoCloseAt: now,
            lastGithubPrAutoCloseStatus: status,
            updatedAt: now,
        })
        .where(eq(projectSettings.projectId, projectId))
        .run();
}

