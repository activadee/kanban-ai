import { resolveDevDbPath } from '../db/paths'
import type { ServerConfig } from '../env'

export const applyDevDatabaseConfig = (config: ServerConfig): ServerConfig => {
  if (config.databaseUrl) return config

  const devDatabaseUrl = config.env.KANBANAI_DEV_DATABASE_URL?.trim()
  const databaseUrl = devDatabaseUrl || resolveDevDbPath(config)
  return { ...config, databaseUrl }
}
