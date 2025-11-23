import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'

const root = path.resolve(import.meta.dir, '..')

type Target = {
  id: string
  bunTarget: string
  binaryName: string
  zipName: string
}

const targets: Target[] = [
  { id: 'linux-x64', bunTarget: 'bun-linux-x64', binaryName: 'kanban-ai-linux-x64', zipName: 'kanban-ai-linux-x64.zip' },
  { id: 'linux-arm64', bunTarget: 'bun-linux-arm64', binaryName: 'kanban-ai-linux-arm64', zipName: 'kanban-ai-linux-arm64.zip' },
  { id: 'darwin-arm64', bunTarget: 'bun-darwin-arm64', binaryName: 'kanban-ai-darwin-arm64', zipName: 'kanban-ai-darwin-arm64.zip' },
  { id: 'win-x64', bunTarget: 'bun-windows-x64', binaryName: 'kanban-ai-win-x64.exe', zipName: 'kanban-ai-win-x64.zip' },
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

async function bundleMigrations() {
  await run('bun', [path.join(root, 'scripts', 'bundle-drizzle-migrations.ts')])
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

async function compileBinary(target: Target) {
  const outDir = path.join(root, 'cli', 'dist')
  await fs.promises.mkdir(outDir, { recursive: true })
  const outfile = path.join(outDir, target.binaryName)

  const buildArgs = [
    'build',
    '--compile',
    'server/src/bin/standalone.ts',
    '--embed=client/dist/**',
    '--embed=server/drizzle/**',
    '--asset-naming=[name].[ext]',
    '--sourcemap=none',
    '--minify',
    '--target',
    target.bunTarget,
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

async function packageZip(target: Target, binaryPath: string) {
  const platformDir = path.join(root, 'cli', 'dist', target.id)
  await fs.promises.mkdir(platformDir, { recursive: true })
  const zipPath = path.join(platformDir, target.zipName)

  const zip = new AdmZip()
  zip.addLocalFile(binaryPath, undefined, path.basename(binaryPath))
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true })
  zip.writeZip(zipPath)

  console.log(`[build-binaries] packaged ${zipPath}`)
}

async function main() {
  console.log('[build-binaries] building client')
  await ensureClientBuild()

  console.log('[build-binaries] verifying drizzle metadata')
  await ensureDrizzleMeta()
  console.log('[build-binaries] bundling drizzle migrations')
  await bundleMigrations()

  await fs.promises.rm(path.join(root, 'cli', 'dist'), { recursive: true, force: true })

  for (const target of selectedTargets) {
    console.log(`[build-binaries] compiling ${target.id}`)
    const binaryPath = await compileBinary(target)
    await packageZip(target, binaryPath)
  }
}

main().catch((error) => {
  console.error('[build-binaries] failed', error)
  process.exit(1)
})
