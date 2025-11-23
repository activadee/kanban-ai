import path from 'node:path'
import { setAppReady } from './app'

const env = () => Bun.env ?? (process.env as Record<string, string | undefined>)

export async function resolveMigrationsFolder(explicit?: string): Promise<string> {
  if (explicit) return explicit === '__embedded__' ? new URL('../drizzle', import.meta.url).pathname : path.resolve(explicit)

  const fromEnv = env().KANBANAI_MIGRATIONS_DIR
  if (fromEnv) return fromEnv === '__embedded__' ? new URL('../drizzle', import.meta.url).pathname : path.resolve(fromEnv)

  const cwdCandidate = path.resolve(process.cwd(), 'drizzle')
  if (await Bun.file(path.join(cwdCandidate, 'meta/_journal.json')).exists()) return cwdCandidate

  const devMeta = new URL('../drizzle/meta/_journal.json', import.meta.url).pathname
  if (await Bun.file(devMeta).exists()) return new URL('../drizzle', import.meta.url).pathname

  throw new Error(
    'server/drizzle not found. Set KANBANAI_MIGRATIONS_DIR or include a drizzle folder next to the executable.',
  )
}

export function markReady() {
  setAppReady(true)
}
