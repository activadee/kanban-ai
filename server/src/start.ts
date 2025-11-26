import type { AppEnv, ServerConfig } from './env'
import { setRuntimeConfig } from './env'
import type { UpgradeWebSocket } from 'hono/ws'
import { resolveMigrations, markReady } from './runtime'
import { createDbClient } from './db/client'
import { registerCoreDbProvider } from './db/provider'
import { settingsService } from 'core'
import { log, applyLogConfig } from './log'
import type { DbResources } from './db/client'

type BunServeOptions = Parameters<typeof Bun.serve>[0];

export type StartOptions = {
  config: ServerConfig;
  fetch: NonNullable<BunServeOptions['fetch']>;
  websocket: NonNullable<BunServeOptions['websocket']>;
  migrationsDir?: string;
  db?: DbResources;
};

export type StartResult = {
  server: ReturnType<(typeof Bun)['serve']>;
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

async function bootstrapRuntime(config: ServerConfig, dbResources: DbResources, migrationsDir?: string) {
  const resolved = await resolveMigrations(config, migrationsDir)
  if (resolved.kind === 'folder') {
    const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
    await migrate(dbResources.db, { migrationsFolder: resolved.path })
  } else {
    await (dbResources.db as any).dialect.migrate(resolved.migrations, (dbResources.db as any).session)
  }

  registerCoreDbProvider(dbResources.db)
  try {
    await settingsService.ensure()
  } catch (error) {
    log.warn({ err: error }, '[settings] init failed')
  }
  return resolved.kind === 'folder' ? resolved.path : '__bundled__'
}

export async function startServer(options: StartOptions): Promise<StartResult> {
  const config = options.config
  setRuntimeConfig(config)
  applyLogConfig(config)
  const dbResources = options.db ?? createDbClient(config)
  const migrationsDir = await bootstrapRuntime(config, dbResources, options.migrationsDir ?? config.migrationsDir)

  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch: options.fetch,
    websocket: options.websocket,
  })

  const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${server.port}`
  const dbFile = dbResources.sqlite.filename ?? dbResources.path
  markReady()
  return { server, url, dbFile, migrationsDir }
}
