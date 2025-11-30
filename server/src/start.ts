import type { AppEnv, ServerConfig } from './env'
import { setRuntimeConfig } from './env'
import type { UpgradeWebSocket } from 'hono/ws'
import { resolveMigrations, markReady } from './runtime'
import type { ResolvedMigrations } from './runtime'
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

function describeAppliedMigrations(resolved: ResolvedMigrations, dbResources: DbResources) {
  const hashRows = (() => {
    try {
      return dbResources.sqlite
        .query('SELECT hash FROM __drizzle_migrations ORDER BY id DESC LIMIT 5')
        .all() as Array<{ hash: string }>
    } catch (err) {
      try {
        return dbResources.sqlite
          .query('SELECT hash FROM drizzle_migrations ORDER BY id DESC LIMIT 5')
          .all() as Array<{ hash: string }>
      } catch (err2) {
        log.debug('migrations', 'could not read migrations table', { err: err2 })
        return [] as Array<{ hash: string }>
      }
    }
  })()

  const hashes = hashRows.map((r) => r.hash)
  const latestHash = hashes[0] ?? null
  let latestTag: string | null = null
  let recentTags: string[] = []

  if (hashes.length > 0) {
    if (resolved.kind === 'bundled') {
      const map = new Map<string, string>()
      for (const m of resolved.migrations) {
        if (m.hash) map.set(m.hash, (m as any).tag ?? '')
      }
      latestTag = latestHash ? map.get(latestHash) ?? latestHash : null
      recentTags = hashes.map((h) => map.get(h) ?? h)
    } else {
      // folder: best-effort map by journal order
      try {
        const journalPath = path.join(resolved.path, 'meta', '_journal.json')
        const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
        const entries = Array.isArray(journal?.entries) ? journal.entries : []
        const byIndex = entries.map((e: any) => e?.tag).filter(Boolean)
        const appliedCount = hashRows.length
        const lastIdx = appliedCount - 1
        latestTag = byIndex[lastIdx] ?? null
        recentTags = byIndex.slice(-appliedCount)
      } catch (err) {
        log.debug('migrations', 'failed to map folder hashes to tags', { err })
        recentTags = hashes
      }
    }
  }

  return { count: hashes.length, latestTag, latestHash, recentTags, recentHashes: hashes }
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
    const applied = describeAppliedMigrations(resolved, dbResources)
    log.info('migrations', 'folder migrations applied', {
      path: resolved.path,
      dbPath: dbResources.path,
      latestTag: applied.latestTag,
      latestHash: applied.latestHash,
      recentTags: applied.recentTags,
    })
  } else {
    log.info('migrations', 'applying bundled migrations', {
      count: resolved.migrations.length,
    })
    await (dbResources.db as any).dialect.migrate(resolved.migrations, (dbResources.db as any).session)
    const applied = describeAppliedMigrations(resolved, dbResources)
    log.info('migrations', 'bundled migrations applied', {
      count: resolved.migrations.length,
      dbPath: dbResources.path,
      latestTag: applied.latestTag,
      latestHash: applied.latestHash,
      recentTags: applied.recentTags,
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
