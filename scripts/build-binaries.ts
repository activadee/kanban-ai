import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')

const targets = [
  { id: 'linux-x64', bunTarget: 'bun-linux-x64', binaryName: 'kanban-ai-linux-x64' },
  { id: 'linux-arm64', bunTarget: 'bun-linux-arm64', binaryName: 'kanban-ai-linux-arm64' },
  { id: 'darwin-arm64', bunTarget: 'bun-darwin-arm64', binaryName: 'kanban-ai-darwin-arm64' },
  { id: 'win-x64', bunTarget: 'bun-windows-x64', binaryName: 'kanban-ai-win-x64.exe' },
]

const args = Bun.argv.slice(2)
const targetArgIndex = args.indexOf('--target')
const targetFilter = targetArgIndex >= 0 && args[targetArgIndex + 1] ? args[targetArgIndex + 1] : undefined
const selectedTargets = targetFilter ? targets.filter((t) => t.id === targetFilter) : targets

if (selectedTargets.length === 0) {
  console.error(`[build-binaries] Unknown target: ${targetFilter}`)
  process.exit(1)
}

async function run(command: string, commandArgs: string[]) {
  const proc = Bun.spawn({ cmd: [command, ...commandArgs], cwd: root, stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed with exit code ${code}`)
  }
}

async function ensureClientBuild() {
  await run('bun', ['run', 'build:client'])
  const clientDist = path.join(root, 'client', 'dist')
  if (!fs.existsSync(clientDist)) {
    throw new Error('[build-binaries] client/dist missing after build')
  }
  await stripSourceMaps(clientDist)
}

async function ensureDrizzleMeta() {
  const drizzleDir = path.join(root, 'server', 'drizzle')
  if (!(await fs.promises.stat(drizzleDir).catch(() => null))) {
    throw new Error('[build-binaries] drizzle folder missing. Run migrations first.')
  }
  const journal = path.join(drizzleDir, 'meta', '_journal.json')
  if (!(await fs.promises.stat(journal).catch(() => null))) {
    throw new Error('[build-binaries] drizzle metadata not found. Run migrations first.')
  }
}

async function stripSourceMaps(dir: string) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return stripSourceMaps(full)
      if (entry.name.endsWith('.map')) return fs.promises.rm(full)
      return undefined
    }),
  )
}

async function compileBinary(target: { id: string; bunTarget: string; binaryName: string }) {
  const outDir = path.join(root, 'cli', 'dist')
  await fs.promises.mkdir(outDir, { recursive: true })
  const outfile = path.join(outDir, target.binaryName)

  const staticDir = path.join(root, 'client', 'dist')
  const migrationsDir = path.join(root, 'server', 'drizzle')

  const buildArgs = [
    'build',
    '--compile',
    'server/src/bin/standalone.ts',
    `--embed=${path.relative(root, staticDir)}`,
    `--embed=${path.relative(root, migrationsDir)}`,
    '--asset-naming=[name].[ext]',
    '--target',
    target.bunTarget,
    '--sourcemap=none',
    '--minify',
    '--outfile',
    outfile,
  ] as const

  await run('bun', [...buildArgs])

  if (!outfile.endsWith('.exe')) {
    await fs.promises.chmod(outfile, 0o755)
  }

  console.log(`[build-binaries] built ${outfile}`)
  return outfile
}

async function main() {
  console.log('[build-binaries] building client')
  await ensureClientBuild()

  console.log('[build-binaries] verifying drizzle metadata')
  await ensureDrizzleMeta()

  await fs.promises.rm(path.join(root, 'cli', 'dist'), { recursive: true, force: true })

  for (const target of selectedTargets) {
    console.log(`[build-binaries] compiling ${target.id}`)
    await compileBinary(target)
  }
}

main().catch((error) => {
  console.error('[build-binaries] failed', error)
  process.exit(1)
})
