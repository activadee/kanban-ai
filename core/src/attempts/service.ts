import { existsSync } from "fs";
import type { AttemptStatus } from "shared";
import type {
    AutomationStage,
    ConversationAutomationItem,
    ConversationItem,
} from "shared";
import type { AppEventBus } from "../events/bus";
import { ensureProjectSettings } from "../projects/settings/service";
import { getRepositoryPath, getBoardById, getCardById } from "../projects/repo";
import {
    getWorktreePath,
    getWorktreePathByNames,
    createWorktree,
} from "../ports/worktree";
import { getAgent } from "../agents/registry";
import { renderBranchName } from "../git/branch";
import { settingsService } from "../settings/service";
import { runAutomationCommand } from "../automation/scripts";
import {
    getAttemptById,
    getAttemptForCard,
    insertAttempt,
    updateAttempt,
    listAttemptLogs as repoListAttemptLogs,
    insertAttemptLog,
    insertConversationItem,
    listConversationItems as repoListConversationItems,
    getNextConversationSeq,
} from "./repo";

type StartAttemptInput = {
    boardId: string;
    cardId: string;
    agent: string;
    baseBranch?: string;
    branchName?: string;
    profileId?: string;
};

const running = new Map<
    string,
    {
        controller: AbortController;
        aborted: boolean;
        repoPath: string;
        worktreePath: string;
        boardId: string;
    }
>();

type AttemptServiceDeps = { events: AppEventBus };

function requireEvents(deps?: AttemptServiceDeps): AppEventBus {
    if (!deps?.events)
        throw new Error("Attempt service requires an event bus instance");
    return deps.events;
}

function normalizeScript(source: string | null | undefined): string | null {
    if (typeof source !== "string") return null;
    const trimmed = source.trim();
    return trimmed.length ? trimmed : null;
}

async function appendAutomationConversationItem(
    attemptId: string,
    boardId: string,
    item: ConversationAutomationItem,
    events: AppEventBus,
    seq?: number,
) {
    const ts = (() => {
        const parsed = Date.parse(item.timestamp);
        if (Number.isFinite(parsed)) return new Date(parsed);
        return new Date();
    })();
    const recordId = item.id ?? `auto-${crypto.randomUUID()}`;
    const payload: ConversationAutomationItem = {
        ...item,
        id: recordId,
        timestamp: item.timestamp ?? ts.toISOString(),
    };
    const seqValue =
        typeof seq === "number" ? seq : await getNextConversationSeq(attemptId);
    await insertConversationItem({
        id: recordId,
        attemptId,
        seq: seqValue,
        ts,
        itemJson: JSON.stringify(payload),
    });
    events.publish("attempt.conversation.appended", {
        attemptId,
        boardId,
        item: payload,
    });
    return payload;
}

function deserializeConversationItem(row: {
    id: string;
    ts: Date | number;
    itemJson: string;
}): ConversationItem {
    try {
        const parsed = JSON.parse(row.itemJson) as ConversationItem;
        const timestamp = parsed.timestamp ?? new Date(row.ts).toISOString();
        return { ...parsed, id: parsed.id ?? row.id, timestamp };
    } catch {
        return {
            type: "error",
            timestamp: new Date().toISOString(),
            text: "Failed to load conversation entry",
        };
    }
}

export async function getAttempt(id: string) {
    return getAttemptById(id);
}

export async function listAttemptLogs(attemptId: string) {
    return repoListAttemptLogs(attemptId);
}

export async function getLatestAttemptForCard(boardId: string, cardId: string) {
    const selected = await getAttemptForCard(boardId, cardId);
    if (!selected) return null;
    const logs = await repoListAttemptLogs(selected.id);
    const items = await repoListConversationItems(selected.id);
    return {
        attempt: selected,
        logs,
        conversation: items.map(deserializeConversationItem),
    };
}

export async function startAttempt(
    input: StartAttemptInput,
    deps?: AttemptServiceDeps,
) {
    const events = requireEvents(deps);
    const now = new Date();
    const repoPath = await (async () => {
        const p = await getRepositoryPath(input.boardId);
        if (!p) throw new Error("Board not found");
        return p;
    })();
    const settings = await ensureProjectSettings(input.boardId);
    const existing = await getAttemptForCard(input.boardId, input.cardId);
    const cardRow = await getCardById(input.cardId);
    const boardRow = await getBoardById(input.boardId);
    let id = existing?.id ?? `att-${crypto.randomUUID()}`;
    const base =
        existing?.baseBranch ??
        input.baseBranch ??
        settings.baseBranch ??
        "main";

    let branch = existing?.branchName ?? input.branchName;
    if (!branch) {
        const tmpl =
            settingsService.snapshot().branchTemplate ||
            "{prefix}/{ticketKey}-{slug}";
        const ticket = cardRow?.ticketKey ?? undefined;
        const slugSource = cardRow?.title ?? ticket ?? undefined;
        const prefix = settings.ticketPrefix;
        branch = renderBranchName(tmpl, {
            prefix,
            ticketKey: ticket,
            slugSource,
        });
    }
    if (!branch) branch = `kanbanai/${Math.random().toString(36).slice(2, 8)}`;
    const defaultWorktreePath = boardRow
        ? getWorktreePathByNames(
              boardRow.name,
              cardRow?.title ?? `card-${input.cardId}`,
          )
        : getWorktreePath(input.boardId, id);
    const worktreePath = existing?.worktreePath ?? defaultWorktreePath;
    const profileId = input.profileId ?? settings.defaultProfileId ?? undefined;

    const previousStatus: AttemptStatus | undefined = existing?.status as
        | AttemptStatus
        | undefined;

    if (!existing) {
        await insertAttempt({
            id,
            cardId: input.cardId,
            boardId: input.boardId,
            agent: input.agent,
            status: "queued",
            baseBranch: base,
            branchName: branch,
            worktreePath,
            createdAt: now,
            updatedAt: now,
        });
    } else {
        if (existing.status === "running" || existing.status === "stopping")
            throw new Error("Attempt already running");
        await updateAttempt(existing.id, {
            agent: input.agent,
            status: "queued",
            baseBranch: base,
            branchName: branch,
            worktreePath,
            startedAt: null,
            endedAt: null,
            updatedAt: now,
        });
    }

    const copyScript = normalizeScript(settings.copyFiles);
    const setupScript = normalizeScript(settings.setupScript);
    const cleanupScript = normalizeScript(settings.cleanupScript);

    events.publish("attempt.queued", {
        attemptId: id,
        boardId: input.boardId,
        cardId: input.cardId,
        agent: input.agent,
        baseBranch: base,
        branchName: branch,
        profileId,
    });

    queueMicrotask(async () => {
        let finishAttemptFn: ((status: AttemptStatus) => Promise<void>) | null =
            null;
        let logFn:
            | ((
                  level: "info" | "warn" | "error",
                  message: string,
              ) => Promise<void>)
            | null = null;
        let cleanupRunner: (() => Promise<void>) | null = null;
        try {
            await updateAttempt(id, {
                status: "running",
                startedAt: new Date(),
                updatedAt: new Date(),
            });
            events.publish("attempt.status.changed", {
                attemptId: id,
                boardId: input.boardId,
                status: "running",
                previousStatus: previousStatus ?? "queued",
            });
            events.publish("attempt.started", {
                attemptId: id,
                boardId: input.boardId,
                cardId: input.cardId,
                agent: input.agent,
                branchName: branch,
                baseBranch: base,
                worktreePath,
                profileId,
            });
            let worktreeCreated = false;
            if (!existsSync(worktreePath)) {
                await createWorktree(repoPath, base, branch, worktreePath, {
                    projectId: input.boardId,
                    attemptId: id,
                });
                worktreeCreated = true;
            }
            const agent = getAgent(input.agent);
            if (!agent) throw new Error(`Unknown agent: ${input.agent}`);
            let currentStatus: AttemptStatus = "running";
            let msgSeq = await getNextConversationSeq(id);
            const emit = async (
                evt:
                    | {
                          type: "log";
                          level?: "info" | "warn" | "error";
                          message: string;
                      }
                    | { type: "status"; status: string }
                    | { type: "session"; id: string }
                    | { type: "conversation"; item: ConversationItem },
            ) => {
                const metaNow = running.get(id);
                const isAborted = !!metaNow?.aborted;
                if (
                    isAborted &&
                    (evt.type === "log" || evt.type === "conversation")
                )
                    return;
                if (evt.type === "log") {
                    const ts = new Date();
                    await insertAttemptLog({
                        id: `log-${crypto.randomUUID()}`,
                        attemptId: id,
                        ts,
                        level: evt.level ?? "info",
                        message: evt.message,
                    });
                    events.publish("attempt.log.appended", {
                        attemptId: id,
                        boardId: input.boardId,
                        level: evt.level ?? "info",
                        message: evt.message,
                        ts: ts.toISOString(),
                    });
                } else if (evt.type === "status") {
                    const nextStatus = evt.status as AttemptStatus;
                    const previous = currentStatus;
                    currentStatus = nextStatus;
                    await updateAttempt(id, {
                        status: nextStatus,
                        updatedAt: new Date(),
                    });
                    events.publish("attempt.status.changed", {
                        attemptId: id,
                        boardId: input.boardId,
                        status: nextStatus,
                        previousStatus: previous,
                    });
                } else if (evt.type === "conversation") {
                    const ts = new Date();
                    const recordId = `cmsg-${crypto.randomUUID()}`;
                    const payloadItem: ConversationItem = {
                        ...evt.item,
                        id: recordId,
                        timestamp: evt.item.timestamp ?? ts.toISOString(),
                    };
                    await insertConversationItem({
                        id: recordId,
                        attemptId: id,
                        seq: msgSeq++,
                        ts,
                        itemJson: JSON.stringify(payloadItem),
                    });
                    events.publish("attempt.conversation.appended", {
                        attemptId: id,
                        boardId: input.boardId,
                        item: payloadItem,
                    });
                } else if (evt.type === "session") {
                    try {
                        await updateAttempt(id, {
                            updatedAt: new Date(),
                            sessionId: evt.id,
                        });
                    } catch {}
                    try {
                        const ts = new Date();
                        const message = `[runner] recorded session id ${evt.id}`;
                        await insertAttemptLog({
                            id: `log-${crypto.randomUUID()}`,
                            attemptId: id,
                            ts,
                            level: "info",
                            message,
                        });
                        events.publish("attempt.log.appended", {
                            attemptId: id,
                            boardId: input.boardId,
                            level: "info",
                            message,
                            ts: ts.toISOString(),
                        });
                    } catch {}
                    events.publish("attempt.session.recorded", {
                        attemptId: id,
                        boardId: input.boardId,
                        sessionId: evt.id,
                    });
                }
            };
            const runAutomationStage = async (
                stage: AutomationStage,
                script: string | null,
                options?: {
                    failHard?: boolean;
                },
            ): Promise<ConversationAutomationItem | null> => {
                if (!script) return null;
                const item = await runAutomationCommand({
                    stage,
                    command: script,
                    cwd: worktreePath,
                });
                await emit({ type: "conversation", item });
                if (options?.failHard && item.exitCode !== 0) {
                    throw new Error(
                        `[automation:${stage}] exited with code ${item.exitCode ?? -1}`,
                    );
                }
                return item;
            };
            cleanupRunner = (() => {
                let invoked = false;
                return async () => {
                    if (invoked) return;
                    invoked = true;
                    if (!cleanupScript) return;
                    await runAutomationStage("cleanup", cleanupScript, {
                        failHard: false,
                    });
                };
            })();

            if (worktreeCreated && copyScript) {
                await runAutomationStage("copy_files", copyScript, {
                    failHard: true,
                });
            }
            if (setupScript) {
                await runAutomationStage("setup", setupScript, {
                    failHard: true,
                });
            }
            const ac = new AbortController();
            running.set(id, {
                controller: ac,
                aborted: false,
                repoPath,
                worktreePath,
                boardId: input.boardId,
            });
            let profile: unknown = agent.defaultProfile;
            if (profileId) {
                /* host can resolve profiles externally if needed; skip here to keep core generic */
            }
            const log = async (
                level: "info" | "warn" | "error",
                message: string,
            ) => {
                await emit({ type: "log", level, message });
            };
            logFn = log;
            const code =
                typeof agent.run === "function"
                    ? await agent.run(
                          {
                              attemptId: id,
                              boardId: input.boardId,
                              cardId: input.cardId,
                              worktreePath,
                              repositoryPath: repoPath,
                              branchName: branch,
                              baseBranch: base,
                              cardTitle: cardRow?.title ?? "(untitled)",
                              cardDescription: cardRow?.description ?? null,
                              signal: ac.signal,
                              emit,
                              profileId: profileId ?? null,
                          } as any,
                          profile as any,
                      )
                    : 1;
            await log("info", `[runner] agent exited with code ${code}`);
            const final: AttemptStatus = running.get(id)?.aborted
                ? "stopped"
                : code === 0
                  ? "succeeded"
                  : "failed";
            const endedAt = new Date();
            await updateAttempt(id, {
                status: final,
                endedAt,
                updatedAt: endedAt,
            });
            events.publish("attempt.status.changed", {
                attemptId: id,
                boardId: input.boardId,
                status: final,
                previousStatus: "running",
                endedAt: endedAt.toISOString(),
            });
            events.publish("attempt.completed", {
                attemptId: id,
                boardId: input.boardId,
                cardId: input.cardId,
                status: final,
                worktreePath,
                profileId,
            });
        } catch (err) {
            await insertAttemptLog({
                id: `log-${crypto.randomUUID()}`,
                attemptId: id,
                ts: new Date(),
                level: "error",
                message: `[runner] failed: ${err instanceof Error ? err.message : String(err)}`,
            });
            try {
                await updateAttempt(id, {
                    status: "failed",
                    updatedAt: new Date(),
                });
            } catch {}
        } finally {
            try {
                if (cleanupRunner) await cleanupRunner();
            } catch {}
            running.delete(id);
        }
    });
    const out = await getAttemptById(id);
    if (!out) throw new Error("Failed to start attempt");
    return out;
}

export async function stopAttempt(id: string, deps?: AttemptServiceDeps) {
    try {
        const events = requireEvents(deps);
        const meta = running.get(id);
        const attempt = await getAttemptById(id);
        if (!attempt) return false;

        // Normal stop path: attempt is currently tracked and running
        if (meta) {
            meta.aborted = true;
            meta.controller.abort();
            const updatedAt = new Date();
            await updateAttempt(id, { status: "stopping", updatedAt });
            events.publish("attempt.status.changed", {
                attemptId: id,
                boardId: meta.boardId,
                status: "stopping",
                previousStatus: "running",
                endedAt: null,
            });
            events.publish("attempt.stopped", {
                attemptId: id,
                boardId: meta.boardId,
                reason: "user",
            });
            return true;
        }

        // Force-stop path: no running process tracked, but DB still thinks it's active
        const activeStatuses: AttemptStatus[] = [
            "running",
            "stopping",
            "queued",
        ];
        if (activeStatuses.includes(attempt.status as AttemptStatus)) {
            const now = new Date();
            await updateAttempt(id, {
                status: "stopped",
                endedAt: now,
                updatedAt: now,
            });
            events.publish("attempt.status.changed", {
                attemptId: id,
                boardId: attempt.boardId,
                status: "stopped",
                previousStatus: attempt.status as AttemptStatus,
                endedAt: now.toISOString(),
            });
            events.publish("attempt.stopped", {
                attemptId: id,
                boardId: attempt.boardId,
                reason: "force",
            });
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error stopping attempt:", error);
    }
}

export async function runAttemptAutomation(
    attemptId: string,
    stage: AutomationStage,
    deps?: AttemptServiceDeps,
): Promise<ConversationAutomationItem> {
    const events = requireEvents(deps);
    const attempt = await getAttemptById(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    const settings = await ensureProjectSettings(attempt.boardId);
    const scriptSource = (() => {
        switch (stage) {
            case "copy_files":
                return settings.copyFiles;
            case "setup":
                return settings.setupScript;
            case "dev":
                return settings.devScript;
            case "cleanup":
                return settings.cleanupScript;
            default:
                return null;
        }
    })();
    const script = normalizeScript(scriptSource);
    if (!script)
        throw new Error(`No automation script configured for stage ${stage}`);
    let worktreePath = attempt.worktreePath;
    if (!worktreePath) {
        const cardRow = await getCardById(attempt.cardId);
        const boardRow = await getBoardById(attempt.boardId);
        worktreePath = boardRow
            ? getWorktreePathByNames(
                  boardRow.name,
                  cardRow?.title ?? attempt.cardId,
              )
            : getWorktreePath(attempt.boardId, attempt.id);
    }
    if (!worktreePath)
        throw new Error("Worktree path not available for attempt");
    if (!existsSync(worktreePath)) {
        throw new Error(
            "Worktree is missing; start a new attempt before running automation",
        );
    }
    const item = await runAutomationCommand({
        stage,
        command: script,
        cwd: worktreePath,
    });
    const saved = await appendAutomationConversationItem(
        attemptId,
        attempt.boardId,
        item,
        events,
    );
    return saved;
}

export async function followupAttempt(
    attemptId: string,
    prompt: string,
    profileId?: string,
    deps?: AttemptServiceDeps,
) {
    const events = requireEvents(deps);
    const base = await getAttemptById(attemptId);
    if (!base) throw new Error("Attempt not found");
    if (!base.sessionId)
        throw new Error("No session recorded for this attempt");
    if (base.status === "running" || base.status === "stopping")
        throw new Error("Attempt already running");
    const agent = getAgent(base.agent);
    if (!agent || typeof agent.resume !== "function")
        throw new Error("Agent does not support follow-up");
    const settings = await ensureProjectSettings(base.boardId);
    const effectiveProfileId =
        profileId ?? settings.defaultProfileId ?? undefined;
    const copyScript = normalizeScript(settings.copyFiles);
    const setupScript = normalizeScript(settings.setupScript);
    const cleanupScript = normalizeScript(settings.cleanupScript);
    const now = new Date();
    const repoPath = await (async () => {
        const p = await getRepositoryPath(base.boardId);
        if (!p) throw new Error("Board not found");
        return p;
    })();
    let worktreePath = base.worktreePath;
    if (!worktreePath) {
        const cardRow = await getCardById(base.cardId);
        const boardRow = await getBoardById(base.boardId);
        worktreePath = boardRow
            ? getWorktreePathByNames(
                  boardRow.name,
                  cardRow?.title ?? base.cardId,
              )
            : getWorktreePath(base.boardId, base.id);
    }
    await updateAttempt(base.id, {
        status: "queued",
        worktreePath,
        updatedAt: now,
        startedAt: null,
        endedAt: null,
    });
    events.publish("attempt.queued", {
        attemptId: base.id,
        boardId: base.boardId,
        cardId: base.cardId,
        agent: base.agent,
        branchName: base.branchName,
        baseBranch: base.baseBranch,
        profileId: effectiveProfileId ?? undefined,
    });
    queueMicrotask(async () => {
        let finishAttemptFn: ((status: AttemptStatus) => Promise<void>) | null =
            null;
        let cleanupRunner: (() => Promise<void>) | null = null;
        let currentStatus: AttemptStatus = "running";
        try {
            await updateAttempt(base.id, {
                status: "running",
                startedAt: new Date(),
                updatedAt: new Date(),
            });
            events.publish("attempt.status.changed", {
                attemptId: base.id,
                boardId: base.boardId,
                status: "running",
                previousStatus: base.status as AttemptStatus,
            });
            events.publish("attempt.started", {
                attemptId: base.id,
                boardId: base.boardId,
                cardId: base.cardId,
                agent: base.agent,
                branchName: base.branchName,
                baseBranch: base.baseBranch,
                worktreePath,
                profileId: effectiveProfileId ?? undefined,
            });
            let worktreeCreated = false;
            if (!existsSync(worktreePath)) {
                await createWorktree(
                    repoPath,
                    base.baseBranch,
                    base.branchName,
                    worktreePath,
                    {
                        projectId: base.boardId,
                        attemptId: base.id,
                    },
                );
                worktreeCreated = true;
            }
            const agent = getAgent(base.agent)!;
            let msgSeq = await getNextConversationSeq(base.id);
            const emit = async (
                evt:
                    | {
                          type: "log";
                          level?: "info" | "warn" | "error";
                          message: string;
                      }
                    | { type: "status"; status: string }
                    | { type: "session"; id: string }
                    | { type: "conversation"; item: ConversationItem },
            ) => {
                const metaNow = running.get(base.id);
                const isAborted = !!metaNow?.aborted;
                if (
                    isAborted &&
                    (evt.type === "log" || evt.type === "conversation")
                )
                    return;
                if (evt.type === "log") {
                    const ts = new Date();
                    await insertAttemptLog({
                        id: `log-${crypto.randomUUID()}`,
                        attemptId: base.id,
                        ts,
                        level: evt.level ?? "info",
                        message: evt.message,
                    });
                    events.publish("attempt.log.appended", {
                        attemptId: base.id,
                        boardId: base.boardId,
                        level: evt.level ?? "info",
                        message: evt.message,
                        ts: ts.toISOString(),
                    });
                } else if (evt.type === "status") {
                    const next = evt.status as AttemptStatus;
                    const prev = currentStatus;
                    currentStatus = next;
                    await updateAttempt(base.id, {
                        status: next,
                        updatedAt: new Date(),
                    });
                    events.publish("attempt.status.changed", {
                        attemptId: base.id,
                        boardId: base.boardId,
                        status: next,
                        previousStatus: prev,
                    });
                } else if (evt.type === "conversation") {
                    const ts = new Date();
                    const recordId = `cmsg-${crypto.randomUUID()}`;
                    const payloadItem: ConversationItem = {
                        ...evt.item,
                        id: recordId,
                        timestamp: evt.item.timestamp ?? ts.toISOString(),
                    };
                    await insertConversationItem({
                        id: recordId,
                        attemptId: base.id,
                        seq: msgSeq++,
                        ts,
                        itemJson: JSON.stringify(payloadItem),
                    });
                    events.publish("attempt.conversation.appended", {
                        attemptId: base.id,
                        boardId: base.boardId,
                        item: payloadItem,
                    });
                } else if (evt.type === "session") {
                    try {
                        await updateAttempt(base.id, {
                            updatedAt: new Date(),
                            sessionId: evt.id,
                        });
                    } catch {}
                    events.publish("attempt.session.recorded", {
                        attemptId: base.id,
                        boardId: base.boardId,
                        sessionId: evt.id,
                    });
                }
            };
            const runAutomationStage = async (
                stage: AutomationStage,
                script: string | null,
                options?: {
                    failHard?: boolean;
                },
            ): Promise<ConversationAutomationItem | null> => {
                if (!script) return null;
                const item = await runAutomationCommand({
                    stage,
                    command: script,
                    cwd: worktreePath,
                });
                await emit({ type: "conversation", item });
                if (options?.failHard && item.exitCode !== 0) {
                    throw new Error(
                        `[automation:${stage}] exited with code ${item.exitCode ?? -1}`,
                    );
                }
                return item;
            };
            cleanupRunner = (() => {
                let invoked = false;
                return async () => {
                    if (invoked) return;
                    invoked = true;
                    if (!cleanupScript) return;
                    await runAutomationStage("cleanup", cleanupScript, {
                        failHard: false,
                    });
                };
            })();
            if (worktreeCreated && copyScript) {
                await runAutomationStage("copy_files", copyScript, {
                    failHard: true,
                });
            }
            if (setupScript) {
                await runAutomationStage("setup", setupScript, {
                    failHard: true,
                });
            }
            const ac = new AbortController();
            running.set(base.id, {
                controller: ac,
                aborted: false,
                repoPath,
                worktreePath,
                boardId: base.boardId,
            });
            let profile: unknown = agent.defaultProfile;
            if (effectiveProfileId) {
                /* host can resolve profile JSON externally if desired */
            }
            try {
                const code = await agent.resume!(
                    {
                        attemptId: base.id,
                        boardId: base.boardId,
                        cardId: base.cardId,
                        worktreePath,
                        repositoryPath: repoPath,
                        branchName: base.branchName,
                        baseBranch: base.baseBranch,
                        cardTitle: "",
                        cardDescription: null,
                        signal: ac.signal,
                        emit,
                        sessionId: base.sessionId ?? undefined,
                        followupPrompt: prompt,
                        profileId: effectiveProfileId ?? null,
                    } as any,
                    profile as any,
                );
                await emit({
                    type: "log",
                    level: "info",
                    message: `[runner] agent exited with code ${code}`,
                });
                await emit({
                    type: "status",
                    status: code === 0 ? "succeeded" : "failed",
                });
            } catch (err) {
                await emit({
                    type: "log",
                    level: "error",
                    message: `[runner] failed: ${err instanceof Error ? err.message : String(err)}`,
                });
                await emit({ type: "status", status: "failed" });
            }
            const endedAt = new Date();
            const finalStatus: AttemptStatus =
                currentStatus === "running" ? "failed" : currentStatus;
            if (currentStatus === "running") {
                await updateAttempt(base.id, {
                    status: finalStatus,
                    endedAt,
                    updatedAt: endedAt,
                });
                events.publish("attempt.status.changed", {
                    attemptId: base.id,
                    boardId: base.boardId,
                    status: finalStatus,
                    previousStatus: currentStatus,
                    endedAt: endedAt.toISOString(),
                });
            } else {
                await updateAttempt(base.id, {
                    endedAt,
                    updatedAt: endedAt,
                });
            }
            currentStatus = finalStatus;
            events.publish("attempt.completed", {
                attemptId: base.id,
                boardId: base.boardId,
                cardId: base.cardId,
                status: finalStatus,
                worktreePath,
                profileId: effectiveProfileId ?? undefined,
            });
        } finally {
            try {
                if (cleanupRunner) await cleanupRunner();
            } catch {}
            running.delete(base.id);
        }
    });
}
