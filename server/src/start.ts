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
import crypto from 'node:crypto'

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
  const byPositionTag = hashes.length > 0 && resolved.kind === 'bundled'
    ? (resolved.migrations[Math.min(hashes.length, resolved.migrations.length) - 1] as any)?.tag ?? null
    : null

  if (hashes.length > 0) {
    if (resolved.kind === 'bundled') {
      const map = new Map<string, string>()
      for (const m of resolved.migrations) {
        if (m.hash) map.set(m.hash, (m as any).tag ?? '')
      }
      latestTag = latestHash ? map.get(latestHash) ?? byPositionTag ?? latestHash : byPositionTag
      recentTags = hashes.map((h, idx) => map.get(h) ?? (resolved.migrations[idx] as any)?.tag ?? h)
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

  return {
    count: hashes.length,
    latestTag: latestTag ?? byPositionTag,
    latestHash,
    recentTags,
    recentHashes: hashes,
    expectedCount: resolved.kind === 'bundled' ? resolved.migrations.length : undefined,
  }
}

async function bootstrapRuntime(config: ServerConfig, dbResources: DbResources, migrationsDir?: string) {
  const resolved = await resolveMigrations(config, migrationsDir)

  reconcileMigrations(resolved, dbResources)

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
      expectedCount: applied.expectedCount,
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

type ExpectedMigration = { hash: string; tag?: string }

function getExpectedMigrations(resolved: ResolvedMigrations): ExpectedMigration[] {
  if (resolved.kind === 'bundled') {
    return resolved.migrations.map((m: any) => ({ hash: m.hash, tag: m.tag }))
  }

  const journalPath = path.join(resolved.path, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  const entries = Array.isArray(journal?.entries) ? journal.entries : []

  const expected: ExpectedMigration[] = []
  for (const entry of entries) {
    const filename = `${entry.tag}.sql`
    const fullPath = path.join(resolved.path, filename)
    const sql = readFileSync(fullPath, 'utf8')
    const hash = crypto.createHash('sha256').update(sql).digest('hex')
    expected.push({ hash, tag: entry.tag })
  }
  return expected
}

function readDbMigrations(dbResources: DbResources): { table: string | null; rows: Array<{ id: number; hash: string }> } {
  const tables = ['__drizzle_migrations', 'drizzle_migrations']
  for (const table of tables) {
    try {
      const rows = dbResources.sqlite
        .query(`SELECT id, hash FROM ${table} ORDER BY id`)
        .all() as Array<{ id: number; hash: string }>
      return { table, rows }
    } catch (err) {
      continue
    }
  }
  return { table: null, rows: [] }
}

function reconcileMigrations(resolved: ResolvedMigrations, dbResources: DbResources) {
  const expected = getExpectedMigrations(resolved)
  const expectedHashes = new Set(expected.map((e) => e.hash))

  const { table, rows } = readDbMigrations(dbResources)
  if (!table || rows.length === 0) return

  const mismatched = rows.filter((r) => !expectedHashes.has(r.hash))
  if (mismatched.length === 0) return

  const placeholders = mismatched.map(() => '?').join(', ')
  dbResources.sqlite.run(`DELETE FROM ${table} WHERE hash IN (${placeholders})`, mismatched.map((m) => m.hash))

  log.warn('migrations', 'removed mismatched migration hashes', {
    removed: mismatched.length,
    table,
    removedHashes: mismatched.map((m) => m.hash),
  })
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
