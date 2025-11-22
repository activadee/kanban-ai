import { setAppReady } from './app'

export async function resolveMigrationsFolder(): Promise<string> {
  const devMeta = new URL('../drizzle/meta/_journal.json', import.meta.url).pathname
  if (await Bun.file(devMeta).exists()) return new URL('../drizzle', import.meta.url).pathname
  throw new Error('server/drizzle not found. Generate migrations before starting the server.')
}

export function markReady() {
  setAppReady(true)
}
