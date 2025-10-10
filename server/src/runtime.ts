import { setAppReady } from './app'

export async function openBrowser(url: string) {
  const platform = process.platform
  if (platform === 'darwin') {
    const proc = Bun.spawn(['open', url])
    await proc.exited
    return
  }
  if (platform === 'win32') {
    const proc = Bun.spawn(['cmd', '/c', 'start', '', url])
    await proc.exited
    return
  }
  const proc = Bun.spawn(['xdg-open', url])
  await proc.exited
}

export async function resolveMigrationsFolder(): Promise<string> {
  // 1) Dev: local filesystem ../drizzle
  try {
    const devMeta = new URL('../drizzle/meta/_journal.json', import.meta.url).pathname
    if (await Bun.file(devMeta).exists()) return new URL('../drizzle', import.meta.url).pathname
  } catch {
  }

  // 2) Embedded TS: synthesize migrations from generated module (single source of truth for binary)
  try {
    const { EMBEDDED_MIGRATIONS, EMBEDDED_META } = await import('./drizzle-embed')
    return await synthesizeDrizzleFolder(EMBEDDED_META, EMBEDDED_MIGRATIONS)
  } catch {
  }

  throw new Error('Embedded migrations missing. Run `bun run package:embed:drizzle`.')
}

export async function synthesizeDrizzleFolder(meta: {
  version: string;
  dialect: string;
  entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[]
}, migrations: { tag: string; sql: string }[]): Promise<string> {
  const os = await import('os')
  const path = await import('path')
  const fs = await import('fs/promises')
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'kanbanai-migrations-'))
  await fs.mkdir(path.join(tmpBase, 'meta'), { recursive: true })
  await fs.writeFile(path.join(tmpBase, 'meta', '_journal.json'), JSON.stringify(meta, null, 2))
  const byTag = new Map(migrations.map((m) => [m.tag, m.sql]))
  for (const entry of meta.entries) {
    const sql = byTag.get(entry.tag)
    if (!sql) continue
    await fs.writeFile(path.join(tmpBase, `${entry.tag}.sql`), sql)
  }
  return tmpBase
}

export function markReady() {
  setAppReady(true)
}

