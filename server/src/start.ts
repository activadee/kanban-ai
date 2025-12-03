import type { AppEnv, ServerConfig } from "./env";
import { setRuntimeConfig } from "./env";
import type { UpgradeWebSocket } from "hono/ws";
import { resolveMigrations, markReady } from "./runtime";
import type { ResolvedMigrations } from "./runtime";
import { createDbClient } from "./db/client";
import { registerCoreDbProvider } from "./db/provider";
import { settingsService } from "core";
import { log, applyLogConfig } from "./log";
import type { DbResources } from "./db/client";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
    prismaMigrations,
    type PrismaMigrationSpec,
} from "../prisma/migration-data.generated";

type BunServeOptions = Parameters<typeof Bun.serve>[0];

export type StartOptions = {
    config: ServerConfig;
    fetch: NonNullable<BunServeOptions["fetch"]>;
    websocket: NonNullable<BunServeOptions["websocket"]>;
    migrationsDir?: string;
    db?: DbResources;
};

export type StartResult = {
    server: ReturnType<(typeof Bun)["serve"]>;
    url: string;
    dbFile: string | undefined;
    migrationsDir: string;
};

export async function createWebSocket(): Promise<{
    upgradeWebSocket: UpgradeWebSocket<AppEnv>;
    websocket: NonNullable<BunServeOptions["websocket"]>;
}> {
    const { createBunWebSocket } = await import("hono/bun");
    const { upgradeWebSocket, websocket } = createBunWebSocket();
    return {
        upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv>,
        websocket: websocket as NonNullable<BunServeOptions["websocket"]>,
    };
}

const PRISMA_MIGRATIONS_TABLE = "kanban_migrations";

function resolveMigrationsRoot(resolved: ResolvedMigrations): {
    kind: "bundled" | "folder";
    path?: string;
} {
    if (resolved.kind === "folder") {
        const root = resolved.path;
        if (!existsSync(root)) {
            throw new Error(`Prisma migrations folder not found: ${root}`);
        }

        // Support pointing at either the migrations root or its parent.
        const directLock = path.join(root, "migration_lock.toml");
        if (existsSync(directLock)) {
            return { kind: "folder", path: root };
        }

        const nestedMigrations = path.join(root, "migrations");
        if (existsSync(nestedMigrations)) {
            return { kind: "folder", path: nestedMigrations };
        }

        const prismaNested = path.join(root, "prisma", "migrations");
        if (existsSync(prismaNested)) {
            return { kind: "folder", path: prismaNested };
        }

        return { kind: "folder", path: root };
    }

    return { kind: "bundled" };
}

function loadFolderMigrations(migrationsRoot: string): PrismaMigrationSpec[] {
    const entries = readdirSync(migrationsRoot, { withFileTypes: true });
    const dirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();

    const specs: PrismaMigrationSpec[] = [];
    for (const dir of dirs) {
        const sqlPath = path.join(migrationsRoot, dir, "migration.sql");
        if (!existsSync(sqlPath)) {
            log.warn("migrations", "migration.sql missing in Prisma folder", {
                dir,
                sqlPath,
            });
            continue;
        }
        const sql = readFileSync(sqlPath, "utf8");
        const bundled = prismaMigrations.find((m) => m.id === dir);
        specs.push({
            id: dir,
            name: bundled?.name ?? dir,
            checksum: bundled?.checksum ?? "",
            sql,
        });
    }

    return specs;
}

function ensureMigrationsTable(dbResources: DbResources) {
    dbResources.sqlite
        .query(
            `CREATE TABLE IF NOT EXISTS ${PRISMA_MIGRATIONS_TABLE} (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )`,
        )
        .run();
}

function readAppliedMigrations(
    dbResources: DbResources,
): Array<{ id: string; checksum: string }> {
    try {
        const rows = dbResources.sqlite
            .query(
                `SELECT id, checksum FROM ${PRISMA_MIGRATIONS_TABLE} ORDER BY applied_at`,
            )
            .all() as Array<{ id: string; checksum: string }>;
        return rows;
    } catch {
        return [];
    }
}

export async function bootstrapRuntime(
    config: ServerConfig,
    dbResources: DbResources,
    migrationsDir?: string,
) {
    const resolved = await resolveMigrations(config, migrationsDir);
    const rootInfo = resolveMigrationsRoot(resolved);

    const source = rootInfo.kind;
    const migrations: PrismaMigrationSpec[] =
        rootInfo.kind === "bundled"
            ? prismaMigrations
            : loadFolderMigrations(rootInfo.path!);

    if (migrations.length === 0) {
        log.warn("migrations", "no Prisma migrations found", {
            source,
            migrationsDir: rootInfo.path,
        });
        registerCoreDbProvider(dbResources.db);
        try {
            await settingsService.ensure();
        } catch (error) {
            log.warn("settings", "init failed", { err: error });
        }
        return rootInfo.kind === "bundled" ? "__bundled__" : rootInfo.path!;
    }

    ensureMigrationsTable(dbResources);
    const appliedRows = readAppliedMigrations(dbResources);
    const appliedIds = new Set(appliedRows.map((r) => r.id));

    // If this is an existing database that was previously managed by Drizzle
    // (or already has the full schema), baseline the Prisma migrations table
    // instead of attempting to re-run the initial DDL.
    if (appliedRows.length === 0) {
        try {
            const existingTables = dbResources.sqlite
                .query(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('boards', 'app_settings') LIMIT 1",
                )
                .all() as Array<{ name: string }>;

            if (existingTables.length > 0) {
                // Treat the first migration as the baseline schema for
                // existing Drizzle-managed databases. Later migrations
                // (e.g. FK refinements) are still allowed to run.
                const initial = migrations[0];
                if (initial) {
                    dbResources.sqlite
                        .query(
                            `INSERT OR IGNORE INTO ${PRISMA_MIGRATIONS_TABLE} (id, checksum) VALUES (?1, ?2)`,
                        )
                        .run(initial.id, initial.checksum);
                    appliedIds.add(initial.id);
                }

                log.info(
                    "migrations",
                    "baselined initial Prisma migration for existing schema",
                    {
                        source,
                        id: initial?.id,
                    },
                );
            }
        } catch (err) {
            log.warn(
                "migrations",
                "failed to inspect existing schema for baseline",
                { err },
            );
        }
    }

    const pending = migrations.filter((m) => !appliedIds.has(m.id));

    if (pending.length === 0) {
        log.info("migrations", "no pending Prisma migrations", {
            source,
            total: migrations.length,
        });
    } else {
        log.info("migrations", "applying Prisma migrations", {
            source,
            count: pending.length,
            pending: pending.map((m) => m.id),
        });

        for (const migration of pending) {
            try {
                dbResources.sqlite.run("BEGIN");
                dbResources.sqlite.exec(migration.sql);
                dbResources.sqlite
                    .query(
                        `INSERT INTO ${PRISMA_MIGRATIONS_TABLE} (id, checksum) VALUES (?1, ?2)`,
                    )
                    .run(migration.id, migration.checksum);
                dbResources.sqlite.run("COMMIT");
                log.info("migrations", "applied Prisma migration", {
                    id: migration.id,
                    source,
                });
            } catch (err) {
                try {
                    dbResources.sqlite.run("ROLLBACK");
                } catch {
                    // ignore rollback failures; the database will surface the original error
                }
                log.error("migrations", "failed to apply Prisma migration", {
                    id: migration.id,
                    source,
                    err,
                });
                throw err;
            }
        }
    }

    registerCoreDbProvider(dbResources.db);
    try {
        await settingsService.ensure();
    } catch (error) {
        log.warn("settings", "init failed", { err: error });
    }

    return rootInfo.kind === "bundled" ? "__bundled__" : rootInfo.path!;
}

export async function startServer(options: StartOptions): Promise<StartResult> {
    const config = options.config;
    setRuntimeConfig(config);
    applyLogConfig(config);
    const dbResources = options.db ?? createDbClient(config);
    const migrationsDir = await bootstrapRuntime(
        config,
        dbResources,
        options.migrationsDir ?? config.migrationsDir,
    );

    const server = Bun.serve({
        hostname: config.host,
        port: config.port,
        fetch: options.fetch,
        websocket: options.websocket,
    });

    const url = `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${server.port}`;
    const dbFile = dbResources.sqlite.filename ?? dbResources.path;
    markReady();
    return { server, url, dbFile, migrationsDir };
}
