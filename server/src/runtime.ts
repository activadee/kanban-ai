import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setAppReady } from './app'

const env = () => Bun.env ?? (process.env as Record<string, string | undefined>)

const embeddedRoot = path.resolve(fileURLToPath(new URL('../drizzle', import.meta.url)))
let materializedDir: string | null = null

async function materializeEmbeddedMigrations(): Promise<string> {
  if (materializedDir) return materializedDir

  const journalPath = path.join(embeddedRoot, 'meta/_journal.json')
  const journalFile = Bun.file(journalPath)
  if (!(await journalFile.exists())) {
    throw new Error('[runtime] embedded migrations manifest not found')
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kanbanai-drizzle-'))

  const copy = async (relativePath: string) => {
    const source = Bun.file(path.join(embeddedRoot, relativePath))
    if (!(await source.exists())) {
      throw new Error(`[runtime] embedded migration missing: ${relativePath}`)
    }
    const target = path.join(tmpRoot, relativePath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, Buffer.from(await source.arrayBuffer()))
  }

  await copy('meta/_journal.json')

  const journal = JSON.parse(await journalFile.text())
  for (const entry of journal.entries ?? []) {
    const filename = `${entry.tag}.sql`
    await copy(filename)
  }

  materializedDir = tmpRoot
  return materializedDir
}

export async function resolveMigrationsFolder(explicit?: string): Promise<string> {
  if (explicit) return explicit === '__embedded__' ? materializeEmbeddedMigrations() : path.resolve(explicit)

  const fromEnv = env().KANBANAI_MIGRATIONS_DIR
  if (fromEnv) return fromEnv === '__embedded__' ? materializeEmbeddedMigrations() : path.resolve(fromEnv)

  const cwdCandidate = path.resolve(process.cwd(), 'drizzle')
  if (await Bun.file(path.join(cwdCandidate, 'meta/_journal.json')).exists()) return cwdCandidate

  const devMeta = path.join(embeddedRoot, 'meta/_journal.json')
  if (await Bun.file(devMeta).exists()) return materializeEmbeddedMigrations()

  throw new Error(
    'server/drizzle not found. Set KANBANAI_MIGRATIONS_DIR or include a drizzle folder next to the executable.',
  )
}

export function markReady() {
  setAppReady(true)
}
