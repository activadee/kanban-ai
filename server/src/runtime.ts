import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setAppReady } from './app'

const env = () => Bun.env ?? (process.env as Record<string, string | undefined>)
const devRoot = path.resolve(fileURLToPath(new URL('../drizzle', import.meta.url)))
let materializedDir: string | null = null

async function resolveEmbeddedFile(relativePath: string) {
  const clean = relativePath.replace(/^[/\\]/, '')
  const candidates = [
    path.join('server', 'drizzle', clean),
    path.join('drizzle', clean),
    clean,
  ]

  for (const candidate of candidates) {
    const embedded = Bun.file(candidate)
    if (await embedded.exists()) return embedded
  }

  const devFile = Bun.file(path.join(devRoot, clean))
  if (await devFile.exists()) return devFile

  const blobs = (Bun as any).embeddedFiles as Array<{ name?: string; arrayBuffer?: () => Promise<ArrayBuffer> }> | undefined
  if (blobs) {
    const match = blobs.find((b) => typeof b.name === 'string' && b.name.replace(/^[/\\]/, '').endsWith(clean))
    if (match) return match as any
  }

  return null
}

async function materializeEmbeddedMigrations(): Promise<string> {
  if (materializedDir) return materializedDir

  const journalFile = await resolveEmbeddedFile('meta/_journal.json')
  if (!journalFile) {
    throw new Error('[runtime] embedded migrations manifest not found')
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kanbanai-drizzle-'))

  const copy = async (relativePath: string) => {
    const source = await resolveEmbeddedFile(relativePath)
    if (!source) {
      throw new Error(`[runtime] embedded migration missing: ${relativePath}`)
    }
    const target = path.join(tmpRoot, relativePath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const buf = Buffer.from(await source.arrayBuffer())
    await fs.writeFile(target, buf)
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
  if (explicit) return explicit === '__embedded__' ? await materializeEmbeddedMigrations() : path.resolve(explicit)

  const fromEnv = env().KANBANAI_MIGRATIONS_DIR
  if (fromEnv) return fromEnv === '__embedded__' ? await materializeEmbeddedMigrations() : path.resolve(fromEnv)

  const cwdCandidate = path.resolve(process.cwd(), 'drizzle')
  if (await Bun.file(path.join(cwdCandidate, 'meta/_journal.json')).exists()) return cwdCandidate

  const devMeta = path.join(devRoot, 'meta/_journal.json')
  if (await Bun.file(devMeta).exists()) return devRoot

  if (await resolveEmbeddedFile('meta/_journal.json')) return await materializeEmbeddedMigrations()

  throw new Error(
    'server/drizzle not found. Set KANBANAI_MIGRATIONS_DIR or include a drizzle folder next to the executable.',
  )
}

export function markReady() {
  setAppReady(true)
}
