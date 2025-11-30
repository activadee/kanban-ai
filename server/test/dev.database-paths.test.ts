import { describe, expect, it } from 'vitest'
import path from 'path'
import { applyDevDatabaseConfig } from '../src/entry/dev-config'
import { resolveDefaultDbPath, resolveDevDbPath } from '../src/db/paths'
import type { ServerConfig } from '../src/env'

const createConfig = (
  env: Record<string, string | undefined> = {},
  overrides: Partial<ServerConfig> = {},
): ServerConfig => ({
  host: '127.0.0.1',
  port: 3000,
  databaseUrl: undefined,
  migrationsDir: undefined,
  staticDir: undefined,
  logLevel: 'info',
  debugLogging: false,
  env,
  ...overrides,
})

describe('dev database configuration', () => {
  it('keeps DATABASE_URL precedence when already set', () => {
    const env = {
      DATABASE_URL: 'sqlite:/tmp/prod.db',
      KANBANAI_DEV_DATABASE_URL: 'file:/tmp/dev.db',
    }
    const config = createConfig(env, { databaseUrl: env.DATABASE_URL })

    const result = applyDevDatabaseConfig(config)

    expect(result.databaseUrl).toBe(env.DATABASE_URL)
  })

  it('uses KANBANAI_DEV_DATABASE_URL when DATABASE_URL is absent', () => {
    const env = { KANBANAI_DEV_DATABASE_URL: '  file:/tmp/dev-path.db  ' }
    const config = createConfig(env)

    const result = applyDevDatabaseConfig(config)

    expect(result.databaseUrl).toBe('file:/tmp/dev-path.db')
  })

  it('falls back to the dev-specific default file when no overrides exist', () => {
    const env = {}
    const config = createConfig(env)

    const result = applyDevDatabaseConfig(config)
    const expected = resolveDevDbPath(config)

    expect(result.databaseUrl).toBe(expected)
  })

  it('keeps dev and prod defaults in the same data directory with different filenames', () => {
    const env = {}
    const config = createConfig(env)

    const prodDefault = resolveDefaultDbPath(config)
    const devDefault = resolveDevDbPath(config)

    expect(path.dirname(prodDefault)).toBe(path.dirname(devDefault))
    expect(path.basename(prodDefault)).toBe('kanban.db')
    expect(path.basename(devDefault)).toBe('kanban-dev.db')
  })
})
