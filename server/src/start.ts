import type { AppEnv } from "./env";
import type { UpgradeWebSocket } from "hono/ws";
import { resolveMigrations, markReady } from "./runtime";
import { db, sqliteDatabase } from "./db/client";
import { registerCoreDbProvider } from "./db/provider";
import { settingsService } from "core";

type BunServeOptions = Parameters<typeof Bun.serve>[0];

export type StartOptions = {
  host?: string;
  port?: number;
  fetch: NonNullable<BunServeOptions["fetch"]>;
  websocket: NonNullable<BunServeOptions["websocket"]>;
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
  websocket: NonNullable<BunServeOptions["websocket"]>;
}> {
  const { createBunWebSocket } = await import("hono/bun");
  const { upgradeWebSocket, websocket } = createBunWebSocket();
  return {
    upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv>,
    websocket: websocket as NonNullable<BunServeOptions["websocket"]>,
  };
}

async function bootstrapRuntime(migrationsDir?: string) {
    const resolved = await resolveMigrations(migrationsDir);
    if (resolved.kind === "folder") {
        const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
        await migrate(db, { migrationsFolder: resolved.path });
    } else {
        await (db as any).dialect.migrate(resolved.migrations, (db as any).session);
    }

    registerCoreDbProvider();
    try {
        await settingsService.ensure();
    } catch (error) {
        console.warn("[settings] init failed", error);
    }
    return resolved.kind === "folder" ? resolved.path : "__bundled__";
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
