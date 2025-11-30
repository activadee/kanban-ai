import {createLogger, format, transports} from 'winston'
import type {ServerConfig} from './env'
import {getRuntimeConfig} from './env'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export type LogContext = Record<string, unknown>

export type ScopedLogFn = (scope: string, message: string, context?: LogContext) => void

export type LogApi = {
  error: ScopedLogFn
  warn: ScopedLogFn
  info: ScopedLogFn
  debug: ScopedLogFn
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const normalizeLevel = (raw?: string): LogLevel => {
  switch (raw?.toLowerCase()) {
    case 'error':
      return 'error'
    case 'warn':
    case 'warning':
      return 'warn'
    case 'debug':
    case 'trace':
    case 'verbose':
      return 'debug'
    case 'info':
    default:
      return 'info'
  }
}

const formatValue = (value: unknown): string => {
  if (value instanceof Error) {
    const name = value.name || 'Error'
    const message = value.message || 'unknown error'
    return quoteIfNeeded(`${name}: ${message}`)
  }

  if (value === null || value === undefined) return String(value)

  if (typeof value === 'string') return quoteIfNeeded(value)

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  try {
    const json = JSON.stringify(value)
    if (!json) return '[object]'
    // Avoid huge blobs
    return json.length > 200 ? json.slice(0, 197) + '...' : json
  } catch {
    return '[unserializable]'
  }
}

const quoteIfNeeded = (value: string): string => {
  if (value === '') return '""'
  if (/\s|=/.test(value)) {
    const escaped = value.replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  return value
}

const formatContext = (context: Record<string, unknown>): string => {
  const entries = Object.entries(context).filter(([, v]) => v !== undefined)
  if (!entries.length) return ''
  const parts = entries.map(([key, value]) => `${key}=${formatValue(value)}`)
  return parts.length ? ' ' + parts.join(' ') : ''
}

const baseConfig = getRuntimeConfig()

const winstonLogger = createLogger({
  level: normalizeLevel(baseConfig.logLevel),
  levels: LOG_LEVELS,
  transports: [new transports.Console()],
  format: format.printf((info) => {
    const {level, scope, message, ...meta} = info as {level: string; scope?: string; message: string} & Record<string, unknown>
    const lvl = (level || 'info').toUpperCase().padEnd(5, ' ')
    const sc = scope || 'server'
    const ctx = formatContext(meta)
    return `${lvl} [${sc}] ${message}${ctx}`
  }),
})

const createScopedLogger = (level: LogLevel): ScopedLogFn => {
  return (scope, message, context) => {
    const meta = context ?? {}
    winstonLogger.log({level, scope, message, ...meta})
  }
}

export const log: LogApi = {
  error: createScopedLogger('error'),
  warn: createScopedLogger('warn'),
  info: createScopedLogger('info'),
  debug: createScopedLogger('debug'),
}

export const applyLogConfig = (config: Pick<ServerConfig, 'logLevel'>) => {
  winstonLogger.level = normalizeLevel(config.logLevel)
}
