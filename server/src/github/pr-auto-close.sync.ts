import * as core from "core";
import type {AppEventBus} from "../events/bus";
import {getPullRequest as getPullRequestDefault} from "./pr";
import {log} from "../log";

const DEFAULT_TICK_INTERVAL_SECONDS = 60;
const MAX_UNIQUE_PRS_PER_PROJECT = 50;
const PR_LOOKUP_CONCURRENCY = 3;

export type GithubPrAutoCloseSchedulerOptions = {
    events: AppEventBus;
    intervalSeconds?: number;
};

let tickInProgress = false;

function parsePrUrl(
    prUrl: string,
): {owner: string; repo: string; number: number} | null {
    const trimmed = prUrl.trim();
    const stripGitSuffix = (name: string) =>
        name.toLowerCase().endsWith(".git") ? name.slice(0, -4) : name;

    const safeDecode = (value: string) => {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };

    const isGithubHostname = (hostname: string) => {
        const host = hostname.trim().toLowerCase();
        return (
            host === "github.com" ||
            host === "www.github.com" ||
            host.endsWith(".github.com")
        );
    };

    try {
        const url = (() => {
            try {
                return new URL(trimmed);
            } catch {
                // Allow scheme-less GitHub URLs like "github.com/org/repo/pull/123".
                if (
                    /^(?:github\.com|www\.github\.com|api\.github\.com)\//i.test(
                        trimmed,
                    )
                ) {
                    return new URL(`https://${trimmed}`);
                }
                return null;
            }
        })();
        if (!url) return null;
        const protocol = url.protocol.toLowerCase();
        if (protocol !== "http:" && protocol !== "https:") return null;
        if (!isGithubHostname(url.hostname)) return null;

        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length < 4) return null;

        // API-style: /repos/<owner>/<repo>/pulls/<number>
        if (parts[0]?.toLowerCase() === "repos") {
            if (parts.length < 5) return null;
            const owner = safeDecode(parts[1] ?? "");
            const repo = stripGitSuffix(safeDecode(parts[2] ?? ""));
            const kind = (parts[3] ?? "").toLowerCase();
            const numStr = parts[4] ?? "";
            if (kind !== "pull" && kind !== "pulls") return null;
            const number = Number(numStr);
            if (!Number.isFinite(number)) return null;
            if (!owner || !repo) return null;
            return {owner, repo, number};
        }

        // HTML-style: /<owner>/<repo>/pull/<number>
        const owner = safeDecode(parts[0] ?? "");
        const repo = stripGitSuffix(safeDecode(parts[1] ?? ""));
        const kind = (parts[2] ?? "").toLowerCase();
        const numStr = parts[3] ?? "";
        if (kind !== "pull" && kind !== "pulls") return null;
        const number = Number(numStr);
        if (!Number.isFinite(number)) return null;
        if (!owner || !repo) return null;
        return {owner, repo, number};
    } catch {
        return null;
    }
}

export async function runGithubPrAutoCloseTick(
    events: AppEventBus,
    deps?: Partial<{
        getPullRequest: typeof getPullRequestDefault;
        projectsService: typeof core.projectsService;
        projectsRepo: typeof core.projectsRepo;
        githubRepo: typeof core.githubRepo;
        projectSettingsPrAutoClose: typeof core.projectSettingsPrAutoClose;
        tasks: typeof core.tasks;
        getGitOriginUrl: typeof core.getGitOriginUrl;
        parseGithubOwnerRepo: typeof core.parseGithubOwnerRepo;
    }>,
): Promise<void> {
    if (tickInProgress) return;
    tickInProgress = true;
    const getPullRequest = deps?.getPullRequest ?? getPullRequestDefault;
    const services = deps?.projectsService ?? core.projectsService;
    const repo = deps?.projectsRepo ?? core.projectsRepo;
    const ghRepo = deps?.githubRepo ?? core.githubRepo;
    const settingsSync =
        deps?.projectSettingsPrAutoClose ??
        core.projectSettingsPrAutoClose;
    const taskSvc = deps?.tasks ?? core.tasks;
    const getOriginUrl =
        deps?.getGitOriginUrl ?? core.getGitOriginUrl;
    const parseOrigin =
        deps?.parseGithubOwnerRepo ?? core.parseGithubOwnerRepo;
    try {
        const connection = await ghRepo.getGithubConnection();
        const accessToken = connection?.accessToken ?? null;
        if (!accessToken) return;

        const projects = await services.list();
        const now = new Date();

        for (const project of projects) {
            const projectId = project.id;
            const boardId = project.boardId;
            try {
                const settings = await services.getSettings(projectId);
                if (
                    !settingsSync.isGithubPrAutoCloseEnabled(
                        settings,
                    )
                )
                    continue;
                if (
                    !settingsSync.isGithubPrAutoCloseDue(
                        settings,
                        now,
                    )
                )
                    continue;

                const lockAcquired =
                    await settingsSync.tryStartGithubPrAutoClose(
                        projectId,
                        now,
                    );
                if (!lockAcquired) continue;

                let status: "succeeded" | "failed" = "succeeded";
                let hadErrors = false;
                let movedAny = false;

                try {
                    const originUrl = await getOriginUrl(
                        project.repositoryPath,
                    );
                    if (!originUrl) {
                        log.warn(
                            "github:pr-auto-close",
                            "No GitHub origin; skipping project",
                            {projectId, boardId},
                        );
                        status = "failed";
                        continue;
                    }

                    const origin = parseOrigin(originUrl);
                    if (!origin) {
                        log.warn(
                            "github:pr-auto-close",
                            "Origin is not a GitHub repo; skipping project",
                            {
                                projectId,
                                boardId,
                                originUrl,
                            },
                        );
                        status = "failed";
                        continue;
                    }

                    const columns =
                        await repo.listColumnsForBoard(boardId);
                    const isReviewColumn = (c: {
                        title?: string;
                    }) =>
                        (c.title || "").trim().toLowerCase() ===
                        "review";
                    const isDoneColumn = (c: {
                        title?: string;
                    }) =>
                        (c.title || "").trim().toLowerCase() ===
                        "done";

                    const reviewColumnIds = columns
                        .filter(isReviewColumn)
                        .map((c) => c.id);
                    if (reviewColumnIds.length === 0) continue;

                    const doneColumnId =
                        columns.find(isDoneColumn)?.id ?? null;
                    if (!doneColumnId) {
                        log.warn(
                            "github:pr-auto-close",
                            "No Done column found; refusing to auto-close (expected title Done)",
                            {
                                projectId,
                                boardId,
                            },
                        );
                        status = "failed";
                        continue;
                    }

                    const cards =
                        await repo.listCardsForColumns(
                            reviewColumnIds,
                        );
                    const reviewCardsWithPr = cards.filter(
                        (c) =>
                            Boolean(c.prUrl) &&
                            !c.disableAutoCloseOnPRMerge,
                    );
                    if (reviewCardsWithPr.length === 0) continue;

                    const byPrNumber = new Map<
                        number,
                        typeof reviewCardsWithPr
                    >();
                    for (const card of reviewCardsWithPr) {
                        const parsedPr = parsePrUrl(card.prUrl!);
                        if (!parsedPr) continue;
                        if (
                            parsedPr.owner.toLowerCase() !==
                                origin.owner.toLowerCase() ||
                            parsedPr.repo.toLowerCase() !==
                                origin.repo.toLowerCase()
                        ) {
                            log.warn(
                                "github:pr-auto-close",
                                "PR url does not match project origin; skipping card",
                                {
                                    projectId,
                                    cardId: card.id,
                                    prUrl: card.prUrl,
                                    originOwner: origin.owner,
                                    originRepo: origin.repo,
                                },
                            );
                            continue;
                        }
                        const list = byPrNumber.get(parsedPr.number) ?? [];
                        list.push(card);
                        byPrNumber.set(parsedPr.number, list);
                    }

                    const prEntries = Array.from(byPrNumber.entries());
                    if (prEntries.length > MAX_UNIQUE_PRS_PER_PROJECT) {
                        hadErrors = true;
                        log.warn(
                            "github:pr-auto-close",
                            "Too many PR-linked cards in Review; capping PR lookups for this tick",
                            {
                                projectId,
                                boardId,
                                totalUniquePrs: prEntries.length,
                                cappedAt: MAX_UNIQUE_PRS_PER_PROJECT,
                            },
                        );
                        prEntries.length = MAX_UNIQUE_PRS_PER_PROJECT;
                    }

                    const parseGithubStatus = (error: unknown): number | null => {
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        const match = message.match(/\((\d{3})\)/);
                        if (!match?.[1]) return null;
                        const code = Number(match[1]);
                        return Number.isFinite(code) ? code : null;
                    };

                    const shouldStopOnError = (error: unknown): boolean => {
                        const statusCode = parseGithubStatus(error);
                        if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
                            return true;
                        }
                        if (
                            error instanceof Error &&
                            /rate limit/i.test(error.message)
                        ) {
                            return true;
                        }
                        return false;
                    };

                    let stop = false;
                    let cursor = 0;

                    const workerCount = Math.min(
                        PR_LOOKUP_CONCURRENCY,
                        prEntries.length,
                    );

                    const runOne = async (
                        prNumber: number,
                        cardsForPr: typeof reviewCardsWithPr,
                    ) => {
                        const pr = await getPullRequest(
                            projectId,
                            accessToken,
                            prNumber,
                        );
                        if (pr.state !== "closed" || !pr.merged) return;

                        if (!taskSvc.moveBoardCard) {
                            throw new Error(
                                "tasks.moveBoardCard is not available",
                            );
                        }

                        for (const card of cardsForPr) {
                            await taskSvc.moveBoardCard(
                                card.id,
                                doneColumnId,
                                Number.MAX_SAFE_INTEGER,
                                {suppressBroadcast: true},
                            );
                            movedAny = true;
                            events.publish(
                                "github.pr.merged.autoClosed",
                                {
                                    projectId,
                                    boardId,
                                    cardId: card.id,
                                    prNumber,
                                    prUrl: card.prUrl!,
                                    ts: new Date().toISOString(),
                                },
                            );
                            log.info(
                                "github:pr-auto-close",
                                "card moved to Done on PR merge",
                                {
                                    projectId,
                                    boardId,
                                    cardId: card.id,
                                    ticketKey: card.ticketKey ?? null,
                                    prNumber,
                                    prUrl: card.prUrl,
                                },
                            );
                        }
                    };

                    await Promise.all(
                        Array.from({length: workerCount}, async () => {
                            while (!stop) {
                                const index = cursor++;
                                const entry = prEntries[index];
                                if (!entry) return;

                                const prNumber = entry[0];
                                const cardsForPr = entry[1];

                                try {
                                    await runOne(prNumber, cardsForPr);
                                } catch (error) {
                                    hadErrors = true;
                                    log.warn(
                                        "github:pr-auto-close",
                                        "PR auto-close failed",
                                        {
                                            err: error,
                                            projectId,
                                            boardId,
                                            prNumber,
                                        },
                                    );
                                    if (shouldStopOnError(error)) {
                                        stop = true;
                                        log.warn(
                                            "github:pr-auto-close",
                                            "Stopping PR auto-close early due to GitHub API error",
                                            {
                                                projectId,
                                                boardId,
                                                prNumber,
                                                statusCode:
                                                    parseGithubStatus(
                                                        error,
                                                    ),
                                            },
                                        );
                                    }
                                }
                            }
                        }),
                    );

                    if (movedAny) {
                        try {
                            if (taskSvc.broadcastBoard) {
                                await taskSvc.broadcastBoard(boardId);
                            }
                        } catch (error) {
                            hadErrors = true;
                            log.warn(
                                "github:pr-auto-close",
                                "Board broadcast failed after PR auto-close",
                                {err: error, projectId, boardId},
                            );
                        }
                    }
                } catch (error) {
                    status = "failed";
                    log.error(
                        "github:pr-auto-close",
                        "Scheduled PR auto-close failed",
                        {err: error, projectId},
                    );
                } finally {
                    try {
                        if (status !== "failed" && hadErrors) {
                            status = "failed";
                        }
                        await settingsSync.completeGithubPrAutoClose(
                            projectId,
                            status,
                            new Date(),
                        );
                    } catch (completeError) {
                        log.warn(
                            "github:pr-auto-close",
                            "Failed to persist PR auto-close status",
                            {err: completeError, projectId},
                        );
                    }
                }
            } catch (error) {
                log.error(
                    "github:pr-auto-close",
                    "Unexpected error during scheduled PR auto-close for project",
                    {err: error, projectId},
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
