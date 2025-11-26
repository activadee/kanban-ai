import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { dbSchema } from 'core'
import os from 'os'
import path from 'path'
import fs from 'fs'
import type { RuntimeEnv, ServerConfig } from '../env'

const resolveDataDir = (env: RuntimeEnv) => {
  const platform = process.platform
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'KanbanAI')
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || env.APPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(base, 'KanbanAI')
  }
  const xdg = env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
  return path.join(xdg, 'kanbanai')
}

const normalizeDbPath = (raw: string) => {
  if (raw === ':memory:') return raw

  const hasQuery = raw.includes('?')
  const isUri = raw.startsWith('file:') || raw.startsWith('sqlite:')
  if (isUri) {
    if (hasQuery) return raw
    try {
      const url = new URL(raw)
      const filePath = url.pathname
      return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
    } catch {
      return raw
    }
  }

  return raw
}

const resolveDbPath = (config: ServerConfig) => {
  const fromEnv = config.databaseUrl
  if (fromEnv) {
    if (fromEnv.startsWith('file:') || fromEnv.startsWith('sqlite:')) return fromEnv
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), normalizeDbPath(fromEnv))
  }

  return path.join(resolveDataDir(config.env), 'kanban.db')
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
