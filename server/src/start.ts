import type { AppEnv } from "./env";
import type { UpgradeWebSocket } from "hono/ws";
import { resolveMigrationsFolder, markReady } from "./runtime";
import { db, sqliteDatabase } from "./db/client";
import { registerCoreDbProvider } from "./db/provider";
import { settingsService } from "core";

export type StartOptions = {
    host?: string;
    port?: number;
    fetch: (request: Request) => Promise<Response> | Response;
    websocket?: any;
    migrationsDir?: string;
};

export type StartResult = {
    server: ReturnType<(typeof Bun)["serve"]>;
    url: string;
    dbFile: string | undefined;
    migrationsDir: string;
};

const env = () =>
    Bun.env ?? (process.env as Record<string, string | undefined>);

export async function createWebSocket(): Promise<{
    upgradeWebSocket: UpgradeWebSocket<AppEnv>;
    websocket: any;
}> {
    const { createBunWebSocket } = await import("hono/bun");
    const { upgradeWebSocket, websocket } = createBunWebSocket();
    return {
        upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv>,
        websocket,
    };
}

async function bootstrapRuntime(migrationsDir?: string) {
    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
    let resolvedMigrations: string | undefined;

    try {
        const bundle = (await import("../drizzle/migrations")).migrations;
        if (bundle) {
            await migrate(db, { migrations: bundle });
            resolvedMigrations = "__bundle__";
        }
    } catch {}

    if (!resolvedMigrations) {
        const folder = await resolveMigrationsFolder(migrationsDir);
        await migrate(db, { migrationsFolder: folder });
        resolvedMigrations = folder;
    }

    registerCoreDbProvider();
    try {
        await settingsService.ensure();
    } catch (error) {
        console.warn("[settings] init failed", error);
    }
    return resolvedMigrations;
}

export async function startServer(options: StartOptions): Promise<StartResult> {
    const host = options.host ?? env().HOST ?? "127.0.0.1";
    const port = Number(options.port ?? env().PORT ?? 3000);
    const migrationsDir = await bootstrapRuntime(options.migrationsDir);

    const server = Bun.serve({
        hostname: host,
        port,
        fetch: options.fetch,
        websocket: options.websocket,
    });

    const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${server.port}`;
    const dbFile = sqliteDatabase.filename ?? "db";
    markReady();
    return { server, url, dbFile, migrationsDir };
}
