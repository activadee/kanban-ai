import type { ProjectsService } from 'core'
import type { settingsService } from 'core'
import type { AppEventBus } from './events/bus'

export type EnvBindings = {
  DATABASE_URL?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

export type AppServices = {
  projects: ProjectsService
  settings: typeof settingsService
}

export type RuntimeEnv = Record<string, string | undefined>

export type ServerConfig = {
  host: string
  port: number
  databaseUrl?: string
  migrationsDir?: string
  staticDir?: string
  logLevel: string
  debugLogging: boolean
  env: RuntimeEnv
}

const FALSEY_FLAGS = ['0', 'false', 'off', 'quiet', 'silent']

const defaultEnv = () => (typeof Bun !== 'undefined' ? Bun.env : process.env)

const isFalseyFlag = (value?: string) => (value ? FALSEY_FLAGS.includes(value.toLowerCase()) : false)

const matchesDebugNamespace = (value: string) =>
  value.split(/[,\s]+/).some((token) => token === '*' || token.startsWith('kanbanai') || token.startsWith('kanban-ai'))

const computeDebugLogging = (env: RuntimeEnv) => {
  const normalizedLevel = env.LOG_LEVEL?.toLowerCase()
  if (normalizedLevel && !isFalseyFlag(normalizedLevel) && normalizedLevel.startsWith('debug')) return true

  const normalizedKanban = env.KANBANAI_DEBUG?.toLowerCase()
  if (normalizedKanban && !isFalseyFlag(normalizedKanban)) return true

  const normalizedDebug = env.DEBUG?.toLowerCase()
  if (normalizedDebug && !isFalseyFlag(normalizedDebug)) {
    if (['1', 'true', 'on', 'yes', 'debug', 'verbose', 'trace'].includes(normalizedDebug)) return true
    if (matchesDebugNamespace(normalizedDebug)) return true
  }

  return false
}

const computeLogLevel = (env: RuntimeEnv) => {
  const raw = env.LOG_LEVEL?.toLowerCase()
  if (raw) return raw
  if (computeDebugLogging(env)) return 'debug'
  return 'info'
}

export function loadConfig(rawEnv: RuntimeEnv = defaultEnv()): ServerConfig {
  const env = {...rawEnv}
  const host = env.HOST?.trim() || '127.0.0.1'
  const port = Number(env.PORT ?? 3000)

  return {
    host,
    port: Number.isFinite(port) ? port : 3000,
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    migrationsDir: env.KANBANAI_MIGRATIONS_DIR?.trim() || undefined,
    staticDir: env.KANBANAI_STATIC_DIR?.trim() || undefined,
    logLevel: computeLogLevel(env),
    debugLogging: computeDebugLogging(env),
    env,
  }
}

let cachedConfig: ServerConfig | null = null

export function getRuntimeConfig(): ServerConfig {
  if (!cachedConfig) cachedConfig = loadConfig()
  return cachedConfig
}

export function setRuntimeConfig(config: ServerConfig) {
  cachedConfig = config
}

export const runtimeEnv = () => getRuntimeConfig().env

export type AppEnv = {
  Bindings: EnvBindings
  Variables: {
    services: AppServices
    events: AppEventBus
    config: ServerConfig
    projectId?: string
    boardId?: string
  }
}

export type AppContextVars = AppEnv['Variables']
