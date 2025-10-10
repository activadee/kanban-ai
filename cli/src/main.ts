import type { AppEnv } from "../../server/src/env";
import type { UpgradeWebSocket } from "hono/ws";
import { createApp } from "../../server/src/app";
import { registerClientRoutes } from "../../server/src/client";
import {
  openBrowser,
  resolveMigrationsFolder,
  markReady,
} from "../../server/src/runtime";

if (import.meta.main) {
  const run = async () => {
    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
    const { createBunWebSocket } = await import("hono/bun");

    // Parse CLI flags
    const args = Bun.argv.slice(2);
    const getArg = (name: string, alias?: string): string | undefined => {
      const i = args.indexOf(name);
      const j = alias ? args.indexOf(alias) : -1;
      const idx = i >= 0 ? i : j;
      if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
      return undefined;
    };
    const hasFlag = (name: string) => args.includes(name);

    if (hasFlag("--help") || hasFlag("-h")) {
      const usage = `\nkanbanai — KanbanAI server\n\nUsage:\n  kanbanai [--host <host>] [--port <port>] [--open|--no-open]\n\nOptions:\n  --host         Hostname to bind (default: 127.0.0.1)\n  --port, -p     Port to listen on (default: 3000)\n  --open         Open browser to /app\n  --no-open      Do not open browser\n  --help, -h     Show this help\n  --version, -v  Print version\n`;
      console.log(usage);
      return;
    }

    if (hasFlag("--version") || hasFlag("-v")) {
      // Keep in sync with root package.json version
      console.log("kanbanai", "v0.4.0");
      return;
    }

    const port = Number(getArg("--port", "-p") ?? Bun.env.PORT ?? 3000);
    const host = getArg("--host") ?? Bun.env.HOST ?? "127.0.0.1";
    const shouldOpen = hasFlag("--open") && !hasFlag("--no-open");
    // DB location is always OS data dir; env variables and flags are ignored by design.
    const { db, sqliteDatabase } = await import("../../server/src/db/client");
    const { registerCoreDbProvider } = await import(
      "../../server/src/db/provider"
    );
    const { settingsService } = await import("core");
    const migrationsFolder = await resolveMigrationsFolder();
    await migrate(db, { migrationsFolder });
    // Register core DB provider to route core repos to the same connection
    registerCoreDbProvider();
    // Warm settings cache so sync consumers can read defaults early
    try {
      await settingsService.ensure();
    } catch (e) {
      console.warn("[settings] init failed", e);
    }
    const { upgradeWebSocket, websocket } = createBunWebSocket();
    const app = createApp({
      upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv>,
    });
    await registerClientRoutes(app);
    const server = Bun.serve({
      port,
      hostname: host,
      fetch: app.fetch,
      websocket,
    });

    const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}/app`;
    const dbFile = sqliteDatabase.filename ?? "db";
    console.log(`[server] listening on ${url.replace(/\/app$/, "")}`);
    console.log(`[server] ui: ${url}`);
    console.log(`[server] database: ${dbFile}`);
    // Mark ready after server is listening
    markReady();
    if (shouldOpen) {
      try {
        await openBrowser(url);
      } catch (e) {
        console.warn("[server] failed to open browser", e);
      }
    }
  };

  run().catch((error) => {
    console.error("[server] failed to start", error);
    process.exit(1);
  });
}

export {};
