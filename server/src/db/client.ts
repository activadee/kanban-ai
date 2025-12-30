import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as dbSchema from './schema'
import path from 'path'
import fs from 'fs'
import type { ServerConfig } from '../env'
import { resolveDefaultDbPath } from './paths'

const normalizeDbPath = (raw: string) => {
  if (raw === ':memory:') return raw

  const hasQuery = raw.includes('?')
  const isUri = raw.startsWith('file:') || raw.startsWith('sqlite:')
  if (isUri) {
    if (hasQuery) return raw

    const withoutScheme = raw.replace(/^file:/, '').replace(/^sqlite:/, '')
    const hasAuthority = withoutScheme.startsWith('//')

    // Relative or root-local forms like `file:./db.sqlite`, `file:db.sqlite`,
    // or `sqlite:../db.sqlite` should be resolved against process.cwd().
    if (!hasAuthority) {
      const pathPart = withoutScheme
      return path.isAbsolute(pathPart) ? pathPart : path.resolve(process.cwd(), pathPart)
    }

    // Canonical URIs like file:///abs/path or file://host/path
    try {
      const url = new URL(raw)
      const filePath = url.pathname
      return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
    } catch {
      const stripped = withoutScheme.replace(/^\/+/, '')
      return path.isAbsolute(stripped) ? stripped : path.resolve(process.cwd(), stripped)
    }
  }

  return raw
}

const resolveDbPath = (config: ServerConfig) => {
  const fromEnv = config.databaseUrl
  if (fromEnv) {
    const normalized = normalizeDbPath(fromEnv)
    if (normalized.startsWith('file:') || normalized.startsWith('sqlite:')) return normalized
    return path.isAbsolute(normalized) ? normalized : path.resolve(process.cwd(), normalized)
  }

  return resolveDefaultDbPath(config)
}

export type DbClient = ReturnType<typeof drizzle>
export type DbResources = { db: DbClient; sqlite: Database; path: string }

export const createDbClient = (config: ServerConfig): DbResources => {
  const dbPath = resolveDbPath(config)

  if (dbPath !== ':memory:') {
    try {
      const dir = path.dirname(dbPath)
      fs.mkdirSync(dir, { recursive: true })
    } catch {
      // best effort; Bun/sqlite will throw if it cannot create file
    }
  }

  const sqlite = new Database(dbPath, { create: true })
  sqlite.run('PRAGMA foreign_keys = ON;')

  const db = drizzle(sqlite, { schema: dbSchema as any })
  return { db, sqlite, path: dbPath }
}
