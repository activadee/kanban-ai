import type { AppEnv, ServerConfig } from './env'
import { setRuntimeConfig } from './env'
import type { UpgradeWebSocket } from 'hono/ws'
import { resolveMigrations, markReady } from './runtime'
import { createDbClient } from './db/client'
import { registerCoreDbProvider } from './db/provider'
import { settingsService } from 'core'
import { log, applyLogConfig } from './log'
import type { DbResources } from './db/client'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

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

function describeFolderMigrations(folderPath: string) {
  const journalPath = path.join(folderPath, 'meta', '_journal.json')
  if (!existsSync(journalPath)) return { count: 0, journalPath }
  try {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
    const entries = Array.isArray(journal?.entries) ? journal.entries.length : 0
    return { count: entries, journalPath }
  } catch (err) {
    log.warn('migrations', 'failed to parse journal for logging', { err, journalPath })
    return { count: 0, journalPath }
  }
}

function describeAppliedMigrations(dbResources: DbResources) {
  try {
    const rows = dbResources.sqlite
      .query('SELECT tag FROM drizzle_migrations ORDER BY id DESC LIMIT 5')
      .all() as Array<{ tag: string }>
    const tags = rows.map((r) => r.tag)
    return { count: tags.length, latest: tags[0] ?? null, recent: tags }
  } catch (err) {
    // Table might not exist yet on a fresh DB; keep it best-effort.
    log.debug('migrations', 'could not read drizzle_migrations table', { err })
    return { count: 0, latest: null, recent: [] as string[] }
  }
}

async function bootstrapRuntime(config: ServerConfig, dbResources: DbResources, migrationsDir?: string) {
  const resolved = await resolveMigrations(config, migrationsDir)

  if (resolved.kind === 'folder') {
    const { count, journalPath } = describeFolderMigrations(resolved.path)
    log.info('migrations', 'applying folder migrations', {
      path: resolved.path,
      journalPath,
      count,
    })
    const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
    await migrate(dbResources.db, { migrationsFolder: resolved.path })
    const applied = describeAppliedMigrations(dbResources)
    log.info('migrations', 'folder migrations applied', {
      path: resolved.path,
      dbPath: dbResources.path,
      latest: applied.latest,
      recent: applied.recent,
    })
  } else {
    log.info('migrations', 'applying bundled migrations', {
      count: resolved.migrations.length,
    })
    await (dbResources.db as any).dialect.migrate(resolved.migrations, (dbResources.db as any).session)
    const applied = describeAppliedMigrations(dbResources)
    log.info('migrations', 'bundled migrations applied', {
      count: resolved.migrations.length,
      dbPath: dbResources.path,
      latest: applied.latest,
      recent: applied.recent,
    })
  }

  registerCoreDbProvider(dbResources.db)
  try {
    await settingsService.ensure()
  } catch (error) {
    log.warn('settings', 'init failed', { err: error })
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
