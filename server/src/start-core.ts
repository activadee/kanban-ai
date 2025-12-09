import type { ServerConfig } from './env'
import { resolveMigrations } from './runtime'
import type { ResolvedMigrations } from './runtime'
import type { DbResources } from './db/client'
import { registerCoreDbProvider } from './db/provider'
import { settingsService } from 'core'
import { log } from './log'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  drizzleMigrations,
  type DrizzleMigrationSpec,
} from '../drizzle/migration-data.generated'

const PRISMA_MIGRATIONS_TABLE = 'kanban_migrations'
const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations'

function resolveMigrationsRoot(resolved: ResolvedMigrations): {
  kind: 'bundled' | 'folder'
  path?: string
} {
  if (resolved.kind === 'folder') {
    const root = resolved.path
    if (!existsSync(root)) {
      throw new Error(`Drizzle migrations folder not found: ${root}`)
    }

    const entries = readdirSync(root, {withFileTypes: true})
    const hasSqlFiles = entries.some(
      (e) => e.isFile() && e.name.toLowerCase().endsWith('.sql'),
    )
    if (hasSqlFiles) {
      return {kind: 'folder', path: root}
    }

    const drizzleDir = path.join(root, 'drizzle')
    if (existsSync(drizzleDir)) {
      return {kind: 'folder', path: drizzleDir}
    }

    const nestedMigrations = path.join(root, 'migrations')
    if (existsSync(nestedMigrations)) {
      return {kind: 'folder', path: nestedMigrations}
    }

    return {kind: 'folder', path: root}
  }

  return {kind: 'bundled'}
}

function loadFolderMigrations(migrationsRoot: string): DrizzleMigrationSpec[] {
  const entries = readdirSync(migrationsRoot, {withFileTypes: true})
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.sql'))
    .map((e) => e.name)
    .sort()

  const specs: DrizzleMigrationSpec[] = []
  for (const file of files) {
    const id = file.replace(/\.sql$/i, '')
    const sqlPath = path.join(migrationsRoot, file)
    if (!existsSync(sqlPath)) {
      log.warn('migrations', 'migration file missing in Drizzle folder', {
        file,
        sqlPath,
      })
      continue
    }
    const sql = readFileSync(sqlPath, 'utf8')
    const bundled = drizzleMigrations.find((m) => m.id === id)
    specs.push({
      id,
      name: bundled?.name ?? id,
      checksum: bundled?.checksum ?? '',
      sql,
    })
  }

  return specs
}

function ensureLegacyMigrationsTable(dbResources: DbResources) {
  dbResources.sqlite
    .query(
      `CREATE TABLE IF NOT EXISTS ${PRISMA_MIGRATIONS_TABLE} (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )`,
    )
    .run()
}

function readLegacyAppliedMigrations(
  dbResources: DbResources,
): Array<{id: string; checksum: string}> {
  try {
    const rows = dbResources.sqlite
      .query(
        `SELECT id, checksum FROM ${PRISMA_MIGRATIONS_TABLE} ORDER BY applied_at`,
      )
      .all() as Array<{id: string; checksum: string}>
    return rows
  } catch {
    return []
  }
}

export async function bootstrapRuntime(
  config: ServerConfig,
  dbResources: DbResources,
  migrationsDir?: string,
) {
  const resolved = await resolveMigrations(config, migrationsDir)
  const rootInfo = resolveMigrationsRoot(resolved)

  const source = rootInfo.kind
  const migrations: DrizzleMigrationSpec[] =
    rootInfo.kind === 'bundled'
      ? drizzleMigrations
      : loadFolderMigrations(rootInfo.path!)

  if (migrations.length === 0) {
    const explicit = Boolean(migrationsDir ?? config.migrationsDir)
    const message =
      rootInfo.kind === 'bundled'
        ? 'no bundled Drizzle migrations found; build may be misconfigured'
        : 'no Drizzle migrations found in configured migrations folder'

    log.error('migrations', message, {
      source,
      migrationsDir: rootInfo.path,
      explicit,
    })

    throw new Error(message)
  }

  // Ensure the legacy Prisma migrations table exists so we can detect
  // Prisma-managed databases and baseline Drizzle metadata from it.
  ensureLegacyMigrationsTable(dbResources)

  const legacyRows = readLegacyAppliedMigrations(dbResources)

  // Ensure the Drizzle migrations meta table exists.
  dbResources.sqlite
    .query(
      `CREATE TABLE IF NOT EXISTS ${DRIZZLE_MIGRATIONS_TABLE} (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )`,
    )
    .run()

  const existingDrizzleRows = dbResources.sqlite
    .query(
      `SELECT id, hash FROM ${DRIZZLE_MIGRATIONS_TABLE} ORDER BY created_at`,
    )
    .all() as Array<{id: string; hash: string}>

  const drizzleAppliedIds = new Set(existingDrizzleRows.map((r) => r.id))

  // Migration strategy:
  // - If Drizzle metadata already exists, trust it and ignore legacy Prisma metadata.
  // - Otherwise, if legacy Prisma metadata exists, project it into the Drizzle table.
  // - If neither exists but core tables are present, baseline the first migration only.

  if (drizzleAppliedIds.size === 0) {
    if (legacyRows.length > 0) {
      const unmatchedLegacyIds: string[] = []
      for (const row of legacyRows) {
        const spec = migrations.find((m) => m.id === row.id)
        if (!spec) {
          unmatchedLegacyIds.push(row.id)
          continue
        }
        dbResources.sqlite
          .query(
            `INSERT OR IGNORE INTO ${DRIZZLE_MIGRATIONS_TABLE} (id, hash) VALUES (?1, ?2)`,
          )
          .run(spec.id, spec.checksum)
        drizzleAppliedIds.add(spec.id)
      }

      log.info('migrations', 'seeded Drizzle metadata from Prisma table', {
        source,
        count: drizzleAppliedIds.size,
      })
      if (unmatchedLegacyIds.length > 0) {
        log.warn('migrations', 'legacy Prisma migrations missing from Drizzle specs', {
          source,
          missingIds: unmatchedLegacyIds,
        })
      }
    } else {
      try {
        const existingTables = dbResources.sqlite
          .query(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('boards', 'app_settings') LIMIT 1",
          )
          .all() as Array<{name: string}>

        if (existingTables.length > 0) {
          const initial = migrations[0]
          if (initial) {
            dbResources.sqlite
              .query(
                `INSERT OR IGNORE INTO ${DRIZZLE_MIGRATIONS_TABLE} (id, hash) VALUES (?1, ?2)`,
              )
              .run(initial.id, initial.checksum)
            drizzleAppliedIds.add(initial.id)
          }

          log.info(
            'migrations',
            'baselined initial Drizzle migration for existing schema',
            {
              source,
              id: initial?.id,
            },
          )
        }
      } catch (err) {
        log.warn(
          'migrations',
          'failed to inspect existing schema for baseline',
          {err},
        )
      }
    }
  }

  const pending = migrations.filter((m) => !drizzleAppliedIds.has(m.id))

  if (pending.length === 0) {
    log.info('migrations', 'no pending Drizzle migrations', {
      source,
      total: migrations.length,
    })
  } else {
    log.info('migrations', 'applying Drizzle migrations', {
      source,
      count: pending.length,
      pending: pending.map((m) => m.id),
    })

    for (const migration of pending) {
      try {
        dbResources.sqlite.run('BEGIN')
        dbResources.sqlite.exec(migration.sql)
        dbResources.sqlite
          .query(
            `INSERT INTO ${DRIZZLE_MIGRATIONS_TABLE} (id, hash) VALUES (?1, ?2)`,
          )
          .run(migration.id, migration.checksum)
        dbResources.sqlite.run('COMMIT')
        log.info('migrations', 'applied Drizzle migration', {
          id: migration.id,
          source,
        })
      } catch (err) {
        try {
          dbResources.sqlite.run('ROLLBACK')
        } catch {
          // ignore rollback failures; the database will surface the original error
        }
        log.error('migrations', 'failed to apply Drizzle migration', {
          id: migration.id,
          source,
          err,
        })
        throw err
      }
    }
  }

  registerCoreDbProvider(dbResources.db)
  try {
    await settingsService.ensure()
  } catch (error) {
    log.warn('settings', 'init failed', {err: error})
  }

  return rootInfo.kind === 'bundled' ? '__bundled__' : rootInfo.path!
}
