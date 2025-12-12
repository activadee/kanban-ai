import {projectsService, projectsRepo, githubRepo, projectSettingsSync, tasks} from "core";
import type {AppEventBus} from "../events/bus";
import {getPullRequest} from "./pr";
import {log} from "../log";

const DEFAULT_TICK_INTERVAL_SECONDS = 60;

export type GithubPrAutoCloseSchedulerOptions = {
    events: AppEventBus;
    intervalSeconds?: number;
};

const lastRunByProject = new Map<string, number>();
let tickInProgress = false;

function extractPrNumber(prUrl: string): number | null {
    const match = prUrl.match(/\/pull\/(\d+)(?:$|[?#/])/i);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
}

async function shouldRun(projectId: string, intervalMinutes: number, nowMs: number) {
    const last = lastRunByProject.get(projectId);
    if (!last) return true;
    return nowMs - last >= intervalMinutes * 60 * 1000;
}

export async function runGithubPrAutoCloseTick(events: AppEventBus): Promise<void> {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
        const connection = await githubRepo.getGithubConnection();
        if (!connection?.accessToken) return;

        const projects = await projectsService.list();
        const now = new Date();
        const nowMs = now.getTime();

        for (const project of projects) {
            try {
                const settings = await projectsService.getSettings(project.id);
                if (!settings.autoCloseTicketOnPRMerge) continue;

                const intervalMinutes = projectSettingsSync.normalizeGithubIssueSyncInterval(
                    settings.githubIssueSyncIntervalMinutes,
                );
                if (!(await shouldRun(project.id, intervalMinutes, nowMs))) continue;
                lastRunByProject.set(project.id, nowMs);

                const columns = await projectsRepo.listColumnsForBoard(project.id);
                const reviewColumnIds = columns
                    .filter(
                        (c) => (c.title || "").trim().toLowerCase() === "review",
                    )
                    .map((c) => c.id);
                if (reviewColumnIds.length === 0) continue;

                const cards = await projectsRepo.listCardsForColumns(
                    reviewColumnIds,
                );
                const reviewCardsWithPr = cards.filter(
                    (c) =>
                        Boolean(c.prUrl) &&
                        !(c as any).disableAutoCloseOnPRMerge,
                );
                if (reviewCardsWithPr.length === 0) continue;

                // Group cards by PR number
                const byPrNumber = new Map<number, typeof reviewCardsWithPr>();
                for (const card of reviewCardsWithPr) {
                    const prNumber = extractPrNumber(card.prUrl!);
                    if (!prNumber) continue;
                    const list = byPrNumber.get(prNumber) ?? [];
                    list.push(card);
                    byPrNumber.set(prNumber, list);
                }

                for (const [prNumber, cardsForPr] of byPrNumber.entries()) {
                    try {
                        const pr = await getPullRequest(
                            project.id,
                            connection.accessToken,
                            prNumber,
                        );
                        if (pr.state !== "closed" || !pr.merged) continue;

                        for (const card of cardsForPr) {
                            await tasks.moveCardToColumnByTitle(
                                project.id,
                                card.id,
                                "Done",
                            );
                            events.publish("github.pr.merged.autoClosed", {
                                projectId: project.id,
                                boardId: project.boardId,
                                cardId: card.id,
                                prNumber,
                                prUrl: card.prUrl!,
                                ts: new Date().toISOString(),
                            });
                            log.info(
                                "github:pr-auto-close",
                                "card moved to Done on PR merge",
                                {
                                    projectId: project.id,
                                    boardId: project.boardId,
                                    cardId: card.id,
                                    ticketKey: card.ticketKey ?? null,
                                    prNumber,
                                    prUrl: card.prUrl,
                                },
                            );
                        }
                    } catch (error) {
                        log.warn("github:pr-auto-close", "PR lookup failed", {
                            err: error,
                            projectId: project.id,
                            prNumber,
                        });
                    }
                }
            } catch (error) {
                log.error(
                    "github:pr-auto-close",
                    "Unexpected error during scheduled PR auto-close for project",
                    {err: error, projectId: project.id},
                );
            }
        }
    } catch (error) {
        log.error("github:pr-auto-close", "Scheduled auto-close tick failed", {
            err: error,
        });
    } finally {
        tickInProgress = false;
    }
}

export function startGithubPrAutoCloseScheduler(
    options: GithubPrAutoCloseSchedulerOptions,
): {stop: () => void} {
    const intervalSeconds =
        options.intervalSeconds ?? DEFAULT_TICK_INTERVAL_SECONDS;
    const intervalMs = intervalSeconds * 1000;

    const timer = setInterval(() => {
        void runGithubPrAutoCloseTick(options.events);
    }, intervalMs);

    return {
        stop: () => clearInterval(timer),
    };
}
