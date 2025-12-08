import { beforeEach, describe, expect, it } from "vitest";

import type { DashboardOverview, DashboardTimeRange } from "shared";

import { resolveTimeRange } from "../src/dashboard/time-range";
import { setDbProvider } from "../src/db/provider";

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

    // Two projects/boards.
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
}

async function getOverview(range?: DashboardTimeRange): Promise<DashboardOverview> {
    const service = await import("../src/dashboard/service");
    return service.getDashboardOverview(range);
}

describe("dashboard/service.getDashboardOverview", () => {
    let sqlite: any;
    const baseTime = new Date("2025-01-10T12:00:00Z");

    beforeEach(async () => {
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

        // Within 7 days we see a-1, a-2, a-3 (3 attempts, 2 successes).
        expect(overview.attemptsInRange).toBe(3);
        expect(overview.projectsWithActivityInRange).toBe(2);
        expect(overview.successRateInRange).toBeCloseTo(2 / 3, 5);
    });

    it("treats all_time as including attempts from all history", async () => {
        const timeRange = resolveTimeRange({ preset: "all_time" }, baseTime);
        const overview = await getOverview(timeRange);

        // All four attempts fall into the all_time window.
        expect(overview.attemptsInRange).toBe(4);
        expect(overview.projectsWithActivityInRange).toBe(2);
        expect(overview.successRateInRange).toBeCloseTo(3 / 4, 5);
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
});
