import { beforeEach, describe, expect, it } from "vitest";

import type { DashboardOverview, DashboardTimeRange } from "shared";
import { DASHBOARD_METRIC_KEYS } from "shared";

import { resolveTimeRange } from "../src/dashboard/time-range";
import { setDbProvider } from "../src/db/provider";
import type { Agent } from "../src/agents/types";
import { registerAgent, __resetAgentRegistryForTests } from "../src/agents/registry";

async function createTestDb() {
    const betterSqlite = await import("better-sqlite3");
    const DatabaseCtor: any = (betterSqlite as any).default ?? (betterSqlite as any);
    const sqlite = new DatabaseCtor(":memory:");
    sqlite.pragma("foreign_keys = ON");

    // Minimal schema for the dashboard service to run against.
    sqlite.exec(`
        CREATE TABLE boards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            repository_path TEXT NOT NULL,
            repository_url TEXT,
            repository_slug TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE columns (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            position INTEGER NOT NULL,
            board_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
        );

        CREATE TABLE cards (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            position INTEGER NOT NULL,
            column_id TEXT NOT NULL,
            board_id TEXT,
            ticket_key TEXT,
            ticket_type TEXT,
            pr_url TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX cards_board_ticket_key_idx ON cards(board_id, ticket_key);

        CREATE TABLE attempts (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            card_id TEXT NOT NULL,
            agent TEXT NOT NULL,
            status TEXT NOT NULL,
            base_branch TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            worktree_path TEXT,
            session_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            started_at INTEGER,
            ended_at INTEGER,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        );

        CREATE TABLE attempt_logs (
            id TEXT PRIMARY KEY,
            attempt_id TEXT NOT NULL,
            ts INTEGER NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
        );
    `);

    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const schema = await import("../src/db/schema");

    const db = drizzle(sqlite, { schema });

    setDbProvider({
        getDb() {
            return db;
        },
        async withTx(fn) {
            return fn(db);
        },
    });

    return { db, sqlite };
}

function insertFixtureData(sqlite: any, baseTime: Date) {
    const baseTs = Math.floor(baseTime.getTime() / 1000);
    const day = 24 * 60 * 60;

    // Two projects/boards with attempt activity plus one project with no attempts.
    sqlite
        .prepare(
            `INSERT INTO boards (id, name, repository_path, repository_url, repository_slug, created_at, updated_at)
             VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run("board-1", "Project One", "/repo/one", baseTs - 10 * day, baseTs - 10 * day);
    sqlite
        .prepare(
            `INSERT INTO boards (id, name, repository_path, repository_url, repository_slug, created_at, updated_at)
             VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run("board-2", "Project Two", "/repo/two", baseTs - 20 * day, baseTs - 20 * day);

    sqlite
        .prepare(
            `INSERT INTO boards (id, name, repository_path, repository_url, repository_slug, created_at, updated_at)
             VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run("board-3", "Project Three", "/repo/three", baseTs - 5 * day, baseTs - 5 * day);

    // Columns and cards.
    sqlite
        .prepare(
            `INSERT INTO columns (id, title, position, board_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("col-1", "Todo", 1, "board-1", baseTs - 10 * day, baseTs - 10 * day);
    sqlite
        .prepare(
            `INSERT INTO columns (id, title, position, board_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("col-2", "Todo", 1, "board-2", baseTs - 20 * day, baseTs - 20 * day);

    sqlite
        .prepare(
            `INSERT INTO columns (id, title, position, board_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("col-3", "Todo", 1, "board-3", baseTs - 5 * day, baseTs - 5 * day);

    sqlite
        .prepare(
            `INSERT INTO cards (id, title, description, position, column_id, board_id, ticket_key, ticket_type, pr_url, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        )
        .run("card-1", "Card One", 1, "col-1", "board-1", baseTs - 10 * day, baseTs - 10 * day);
    sqlite
        .prepare(
            `INSERT INTO cards (id, title, description, position, column_id, board_id, ticket_key, ticket_type, pr_url, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        )
        .run("card-2", "Card Two", 1, "col-2", "board-2", baseTs - 20 * day, baseTs - 20 * day);

    sqlite
        .prepare(
            `INSERT INTO cards (id, title, description, position, column_id, board_id, ticket_key, ticket_type, pr_url, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        )
        .run("card-3", "Card Three", 1, "col-3", "board-3", baseTs - 5 * day, baseTs - 5 * day);

    const insertAttempt = sqlite.prepare(
        `INSERT INTO attempts (id, board_id, card_id, agent, status, base_branch, branch_name, worktree_path, session_id, created_at, updated_at, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    );

    // Within last 24h: two attempts, one success and one failure, same project.
    insertAttempt.run(
        "a-1",
        "board-1",
        "card-1",
        "AGENT",
        "succeeded",
        "main",
        "branch-a1",
        baseTs - 1 * day + 100,
        baseTs - 1 * day + 200,
        baseTs - 1 * day + 100,
        baseTs - 1 * day + 200,
    );
    insertAttempt.run(
        "a-2",
        "board-1",
        "card-1",
        "AGENT",
        "failed",
        "main",
        "branch-a2",
        baseTs - 1 * day + 300,
        baseTs - 1 * day + 400,
        baseTs - 1 * day + 300,
        baseTs - 1 * day + 400,
    );

    // Within last 7d but outside last 24h: one succeeded attempt on second project.
    insertAttempt.run(
        "a-3",
        "board-2",
        "card-2",
        "AGENT",
        "succeeded",
        "main",
        "branch-a3",
        baseTs - 3 * day,
        baseTs - 3 * day + 100,
        baseTs - 3 * day,
        baseTs - 3 * day + 100,
    );

    // Older than 7d: should be counted only for all_time.
    insertAttempt.run(
        "a-4",
        "board-2",
        "card-2",
        "AGENT",
        "succeeded",
        "main",
        "branch-a4",
        baseTs - 40 * day,
        baseTs - 40 * day + 100,
        baseTs - 40 * day,
        baseTs - 40 * day + 100,
    );

    // Long-running queued attempt for inbox "stuck".
    insertAttempt.run(
        "a-5",
        "board-1",
        "card-1",
        "AGENT",
        "queued",
        "main",
        "branch-a5",
        baseTs - 2 * day,
        baseTs - 2 * day,
        baseTs - 2 * day,
        null
    );
}

async function getOverview(range?: DashboardTimeRange): Promise<DashboardOverview> {
    const service = await import("../src/dashboard/service");
    return service.getDashboardOverview(range);
}

function getProjectSnapshot(overview: DashboardOverview, projectId: string) {
    const snapshot = overview.projectSnapshots.find((project) => project.projectId === projectId);
    if (!snapshot) {
        throw new Error(`Expected project snapshot for ${projectId}`);
    }
    return snapshot;
}

function createTestAgent(key: string, label: string): Agent<unknown> {
    const agentLike = {
        key,
        label,
        defaultProfile: {},
        profileSchema: {},
        run: async () => 0,
    };
    return agentLike as Agent<unknown>;
}

describe("dashboard/service.getDashboardOverview", () => {
    let sqlite: any;
    const baseTime = new Date("2025-01-10T12:00:00Z");

    beforeEach(async () => {
        __resetAgentRegistryForTests();
        const dbResources = await createTestDb();
        sqlite = dbResources.sqlite;
        insertFixtureData(sqlite, baseTime);
    });

    it("computes in-range metrics for last_24h preset", async () => {
        const timeRange = resolveTimeRange({ preset: "last_24h" }, baseTime);
        const overview = await getOverview(timeRange);

        expect(overview.timeRange.preset).toBe("last_24h");
        expect(overview.attemptsInRange).toBe(2);
        expect(overview.projectsWithActivityInRange).toBe(1);
        expect(overview.successRateInRange).toBeCloseTo(0.5, 5);
    });

    it("computes in-range metrics for last_7d preset", async () => {
        const timeRange = resolveTimeRange({ preset: "last_7d" }, baseTime);
        const overview = await getOverview(timeRange);

        // Within 7 days we see a-1, a-2, a-3, a-5 (4 attempts, 2 successes).
        expect(overview.attemptsInRange).toBe(4);
        expect(overview.projectsWithActivityInRange).toBe(2);
        expect(overview.successRateInRange).toBeCloseTo(2 / 4, 5);
    });

    it("treats all_time as including attempts from all history", async () => {
        const timeRange = resolveTimeRange({ preset: "all_time" }, baseTime);
        const overview = await getOverview(timeRange);

        // All attempts fall into the all_time window.
        expect(overview.attemptsInRange).toBe(5);
        expect(overview.projectsWithActivityInRange).toBe(2);
        expect(overview.successRateInRange).toBeCloseTo(3 / 5, 5);
    });

    it("populates inboxItems with failed and stuck attempts ordered by recency", async () => {
        const timeRange = resolveTimeRange({ preset: "all_time" }, baseTime);
        const overview = await getOverview(timeRange);

        // We expect at least one failed and one stuck item drawn from the fixtures:
        // - a-3 is a succeeded attempt on card-2 that still requires review.
        // - a-2 is a recent failed attempt on card-1.
        // - a-5 is a long-running queued attempt considered "stuck".
        const review = overview.inboxItems.review;
        const failed = overview.inboxItems.failed;
        const stuck = overview.inboxItems.stuck;

        expect(review.length).toBeGreaterThanOrEqual(1);
        expect(failed.length).toBeGreaterThanOrEqual(1);
        expect(stuck.length).toBeGreaterThanOrEqual(1);

        const reviewIds = review.map((item) => item.attemptId);
        const failedIds = failed.map((item) => item.attemptId);
        const stuckIds = stuck.map((item) => item.attemptId);

        expect(reviewIds).toContain("a-3");
        expect(failedIds).toContain("a-2");
        expect(stuckIds).toContain("a-5");

        // Ensure items carry basic context needed by the UI.
        const sample = [...failed, ...stuck][0]!;
        expect(sample.projectId).toBeDefined();
        expect(sample.cardId).toBeDefined();
        expect(sample.agentId).toBeDefined();
        expect(sample.createdAt).toBeTruthy();
    });

    it("returns zero success rate when there are no attempts", async () => {
        // Fresh DB with no attempts.
        const dbResources = await createTestDb();
        sqlite = dbResources.sqlite;
        const timeRange = resolveTimeRange({ preset: "last_24h" }, baseTime);
        const overview = await getOverview(timeRange);

        expect(overview.attemptsInRange).toBe(0);
        expect(overview.projectsWithActivityInRange).toBe(0);
        expect(overview.successRateInRange).toBe(0);
    });

    it("aggregates card counts, column buckets, and attempt metrics per project", async () => {
        const timeRange = resolveTimeRange({ preset: "last_7d" }, baseTime);
        const overview = await getOverview(timeRange);

        const projectOne = getProjectSnapshot(overview, "board-1");
        const projectTwo = getProjectSnapshot(overview, "board-2");
        const projectThree = getProjectSnapshot(overview, "board-3");

        // Card counts and per-column buckets.
        expect(projectOne.totalCards).toBe(1);
        expect(projectOne.openCards).toBe(1);
        expect(projectTwo.totalCards).toBe(1);
        expect(projectTwo.openCards).toBe(1);
        expect(projectThree.totalCards).toBe(1);
        expect(projectThree.openCards).toBe(1);

        expect(projectOne.columnCardCounts).toBeDefined();
        expect(projectTwo.columnCardCounts).toBeDefined();
        expect(projectThree.columnCardCounts).toBeDefined();

        expect(projectOne.columnCardCounts).toEqual({
            backlog: 1,
            inProgress: 0,
            review: 0,
            done: 0,
        });
        expect(projectTwo.columnCardCounts).toEqual({
            backlog: 1,
            inProgress: 0,
            review: 0,
            done: 0,
        });
        expect(projectThree.columnCardCounts).toEqual({
            backlog: 1,
            inProgress: 0,
            review: 0,
            done: 0,
        });

        // Attempt and failure metrics in range.
        expect(projectOne.activeAttempts).toBe(1);
        expect(projectOne.activeAttemptsCount).toBe(1);
        expect(projectOne.attemptsInRange).toBe(3);
        expect(projectOne.failedAttemptsInRange).toBe(1);
        expect(projectOne.failureRateInRange).toBeCloseTo(1 / 3, 5);

        expect(projectTwo.activeAttempts).toBe(0);
        expect(projectTwo.attemptsInRange).toBe(1);
        expect(projectTwo.failedAttemptsInRange).toBe(0);
        expect(projectTwo.failureRateInRange).toBe(0);

        // Project three has cards but no attempts in range.
        expect(projectThree.activeAttempts).toBe(0);
        expect(projectThree.attemptsInRange).toBe(0);
        expect(projectThree.failedAttemptsInRange).toBe(0);
        expect(projectThree.failureRateInRange).toBe(0);
    });

    it("computes project health flags for high activity and at-risk projects", async () => {
        const timeRange = resolveTimeRange({ preset: "last_7d" }, baseTime);

        // Baseline: with the default fixtures, board-1 should be high-activity
        // while none of the projects are at risk.
        const baselineOverview = await getOverview(timeRange);
        const baselineProjectOne = getProjectSnapshot(baselineOverview, "board-1");
        const baselineProjectTwo = getProjectSnapshot(baselineOverview, "board-2");
        const baselineProjectThree = getProjectSnapshot(baselineOverview, "board-3");

        expect(baselineProjectOne.health?.isHighActivity).toBe(true);
        expect(baselineProjectOne.health?.isAtRisk).toBe(false);
        expect(baselineProjectTwo.health?.isHighActivity).toBe(false);
        expect(baselineProjectTwo.health?.isAtRisk).toBe(false);
        expect(baselineProjectThree.health?.isHighActivity).toBe(false);
        expect(baselineProjectThree.health?.isAtRisk).toBe(false);

        // Now insert several failed attempts for board-2 within the same range
        // so that it becomes at risk (high failure rate with sufficient volume).
        const baseTs = Math.floor(baseTime.getTime() / 1000);
        const day = 24 * 60 * 60;

        const insertAttempt = sqlite.prepare(
            `INSERT INTO attempts (id, board_id, card_id, agent, status, base_branch, branch_name, worktree_path, session_id, created_at, updated_at, started_at, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
        );

        for (let index = 0; index < 5; index += 1) {
            const offset = index * 60;
            insertAttempt.run(
                `risk-${index}`,
                "board-2",
                "card-2",
                "AGENT",
                "failed",
                "main",
                `branch-risk-${index}`,
                baseTs - 2 * day + offset,
                baseTs - 2 * day + offset,
                baseTs - 2 * day + offset,
                baseTs - 2 * day + offset,
            );
        }

        const updatedOverview = await getOverview(timeRange);
        const updatedProjectTwo = getProjectSnapshot(updatedOverview, "board-2");

        expect(updatedProjectTwo.attemptsInRange).toBeGreaterThanOrEqual(5);
        expect(updatedProjectTwo.failedAttemptsInRange).toBeGreaterThanOrEqual(5);
        expect(updatedProjectTwo.failureRateInRange).toBeGreaterThan(0.5);
        expect(updatedProjectTwo.health?.isAtRisk).toBe(true);
    });

    it("aggregates per-agent stats over the selected time range", async () => {
        // Register two agents: one with activity (matching the fixtures)
        // and one with no attempts at all to verify inclusion.
        registerAgent(createTestAgent("AGENT", "Fixture Agent"));
        registerAgent(createTestAgent("IDLE", "Idle Agent"));

        const timeRange = resolveTimeRange({ preset: "last_7d" }, baseTime);
        const overview = await getOverview(timeRange);

        // Both registered agents should be present in the agentStats list.
        const ids = overview.agentStats.map((stat) => stat.agentId);
        expect(ids).toContain("AGENT");
        expect(ids).toContain("IDLE");

        const activeAgent = overview.agentStats.find((stat) => stat.agentId === "AGENT");
        const idleAgent = overview.agentStats.find((stat) => stat.agentId === "IDLE");

        expect(activeAgent).toBeDefined();
        expect(idleAgent).toBeDefined();

        // From the fixtures within last_7d we see:
        // - a-1 (succeeded), a-2 (failed), a-3 (succeeded), a-5 (queued) for agent "AGENT".
        expect(activeAgent?.attemptsInRange).toBe(4);
        expect(activeAgent?.hasActivityInRange).toBe(true);
        expect(activeAgent?.successRateInRange).toBeCloseTo(2 / 4, 5);
        expect(activeAgent?.lastActivityAt).not.toBeNull();
        expect(activeAgent?.attemptsFailed).toBe(1);

        // The idle agent has no attempts in range but is still returned.
        expect(idleAgent?.attemptsInRange).toBe(0);
        expect(idleAgent?.hasActivityInRange).toBe(false);
        expect(idleAgent?.successRateInRange).toBeNull();
        expect(idleAgent?.lastActivityAt).toBeNull();
        expect(idleAgent?.attemptsFailed).toBe(0);
    });

    it("exposes headline dashboard metrics via metrics.byKey with correct totals", async () => {
        const timeRange = resolveTimeRange({ preset: "last_7d" }, baseTime);
        const overview = await getOverview(timeRange);

        const metrics = overview.metrics.byKey;

        const projectsTotal = metrics[DASHBOARD_METRIC_KEYS.projectsTotal];
        const activeAttempts = metrics[DASHBOARD_METRIC_KEYS.activeAttempts];
        const attemptsCompleted = metrics[DASHBOARD_METRIC_KEYS.attemptsCompleted];
        const openCards = metrics[DASHBOARD_METRIC_KEYS.openCards];

        expect(projectsTotal.total).toBe(3);
        expect(activeAttempts.total).toBe(1);
        expect(attemptsCompleted.total).toBe(4);
        expect(openCards.total).toBe(3);

        expect(projectsTotal.points).toHaveLength(1);
        expect(projectsTotal.points[0]?.value).toBe(3);
    });

    it("excludes attempts outside the selected time range from in-range metrics", async () => {
        const dayMs = 24 * 60 * 60 * 1000;
        const hourMs = 60 * 60 * 1000;

        const from = new Date(baseTime.getTime() - 3 * dayMs - hourMs).toISOString();
        const to = new Date(baseTime.getTime() - 3 * dayMs + hourMs).toISOString();

        const overview = await getOverview({ from, to });

        expect(overview.timeRange.from).toBe(from);
        expect(overview.timeRange.to).toBe(to);

        expect(overview.attemptsInRange).toBe(1);
        expect(overview.projectsWithActivityInRange).toBe(1);
        expect(overview.successRateInRange).toBe(1);
    });

    it("returns 0% success rate when only failed attempts fall within the selected range", async () => {
        const baseMs = baseTime.getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        const from = new Date(baseMs - 1 * dayMs + 250 * 1000).toISOString();
        const to = new Date(baseMs - 1 * dayMs + 350 * 1000).toISOString();

        const overview = await getOverview({ from, to });

        expect(overview.attemptsInRange).toBe(1);
        expect(overview.successRateInRange).toBe(0);
    });

    it("returns 100% success rate when only succeeded attempts fall within the selected range", async () => {
        const baseMs = baseTime.getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        const from = new Date(baseMs - 40 * dayMs - 2 * dayMs).toISOString();
        const to = new Date(baseMs - 40 * dayMs + 2 * dayMs).toISOString();

        const overview = await getOverview({ from, to });

        expect(overview.attemptsInRange).toBe(1);
        expect(overview.successRateInRange).toBe(1);
    });

    it("returns zeroed in-range metrics when only out-of-range attempts exist", async () => {
        const halfDayMs = 12 * 60 * 60 * 1000;

        const from = new Date(baseTime.getTime() - halfDayMs).toISOString();
        const to = baseTime.toISOString();

        const overview = await getOverview({ from, to });

        expect(overview.attemptsInRange).toBe(0);
        expect(overview.projectsWithActivityInRange).toBe(0);
        expect(overview.successRateInRange).toBe(0);
    });

    it("aggregates per-agent stats for agents with only successes, only failures, and no attempts", async () => {
        const dbResources = await createTestDb();
        sqlite = dbResources.sqlite;

        const baseTs = Math.floor(baseTime.getTime() / 1000);
        const day = 24 * 60 * 60;

        sqlite
            .prepare(
                `INSERT INTO boards (id, name, repository_path, repository_url, repository_slug, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
            )
            .run("board-agents", "Agents Project", "/repo/agents", baseTs - day, baseTs - day);

        sqlite
            .prepare(
                `INSERT INTO columns (id, title, position, board_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run("col-agents", "Todo", 1, "board-agents", baseTs - day, baseTs - day);

        sqlite
            .prepare(
                `INSERT INTO cards (id, title, description, position, column_id, board_id, ticket_key, ticket_type, pr_url, created_at, updated_at)
                 VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
            )
            .run(
                "card-agents",
                "Agent Card",
                1,
                "col-agents",
                "board-agents",
                baseTs - day,
                baseTs - day,
            );

        const insertAttempt = sqlite.prepare(
            `INSERT INTO attempts (id, board_id, card_id, agent, status, base_branch, branch_name, worktree_path, session_id, created_at, updated_at, started_at, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
        );

        insertAttempt.run(
            "success-1",
            "board-agents",
            "card-agents",
            "ONLY_SUCCESS",
            "succeeded",
            "main",
            "branch-success-1",
            baseTs - day + 10,
            baseTs - day + 20,
            baseTs - day + 10,
            baseTs - day + 20,
        );
        insertAttempt.run(
            "success-2",
            "board-agents",
            "card-agents",
            "ONLY_SUCCESS",
            "succeeded",
            "main",
            "branch-success-2",
            baseTs - day + 30,
            baseTs - day + 40,
            baseTs - day + 30,
            baseTs - day + 40,
        );

        insertAttempt.run(
            "failed-1",
            "board-agents",
            "card-agents",
            "ONLY_FAILED",
            "failed",
            "main",
            "branch-failed-1",
            baseTs - day + 50,
            baseTs - day + 60,
            baseTs - day + 50,
            baseTs - day + 60,
        );
        insertAttempt.run(
            "failed-2",
            "board-agents",
            "card-agents",
            "ONLY_FAILED",
            "failed",
            "main",
            "branch-failed-2",
            baseTs - day + 70,
            baseTs - day + 80,
            baseTs - day + 70,
            baseTs - day + 80,
        );

        __resetAgentRegistryForTests();
        registerAgent(createTestAgent("ONLY_SUCCESS", "Always Successful"));
        registerAgent(createTestAgent("ONLY_FAILED", "Always Failing"));
        registerAgent(createTestAgent("NO_ATTEMPTS", "No Attempts"));

        const timeRange = resolveTimeRange({ preset: "last_7d" }, baseTime);
        const overview = await getOverview(timeRange);

        const byId = new Map(overview.agentStats.map((stat) => [stat.agentId, stat]));

        const successAgent = byId.get("ONLY_SUCCESS");
        const failedAgent = byId.get("ONLY_FAILED");
        const idleAgent = byId.get("NO_ATTEMPTS");

        expect(successAgent?.attemptsInRange).toBe(2);
        expect(successAgent?.attemptsFailed).toBe(0);
        expect(successAgent?.successRateInRange).toBe(1);

        expect(failedAgent?.attemptsInRange).toBe(2);
        expect(failedAgent?.attemptsFailed).toBe(2);
        expect(failedAgent?.successRateInRange).toBe(0);

        expect(idleAgent?.attemptsInRange).toBe(0);
        expect(idleAgent?.attemptsFailed).toBe(0);
        expect(idleAgent?.successRateInRange).toBeNull();

        const labels = overview.agentStats.map((stat) => stat.agentName);
        expect(labels).toEqual([...labels].sort());
    });
});
