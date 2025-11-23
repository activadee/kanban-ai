import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
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
}

async function prepareStaging() {
  const stagingRoot = path.join(root, 'dist', 'staging')
  const clientOut = path.join(stagingRoot, 'client-dist')
  const drizzleOut = path.join(stagingRoot, 'drizzle')
  await fs.promises.rm(stagingRoot, { recursive: true, force: true })
  await fs.promises.mkdir(stagingRoot, { recursive: true })

  const clientDist = path.join(root, 'client', 'dist')
  const drizzleDir = path.join(root, 'server', 'drizzle')
  if (!fs.existsSync(path.join(drizzleDir, 'meta'))) {
    throw new Error('[build-binaries] drizzle metadata not found. Run migrations first.')
  }

  await fs.promises.cp(clientDist, clientOut, { recursive: true })
  await fs.promises.cp(drizzleDir, drizzleOut, { recursive: true })
  await stripSourceMaps(clientOut)
  return { stagingRoot, clientOut, drizzleOut }
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
  const binDir = path.join(root, 'dist', 'bin')
  await fs.promises.mkdir(binDir, { recursive: true })
  const outfile = path.join(binDir, target.binaryName)
  await run('bun', [
    'build',
    '--compile',
    'server/src/bin/standalone.ts',
    '--target',
    target.bunTarget,
    '--outfile',
    outfile,
  ])
  if (!outfile.endsWith('.exe')) {
    await fs.promises.chmod(outfile, 0o755)
  }
  return outfile
}

async function zipBinary(binaryPath: string, targetId: string, staging: { clientOut: string; drizzleOut: string }) {
  const zipDir = path.join(root, 'cli', 'dist')
  await fs.promises.mkdir(zipDir, { recursive: true })
  const zipPath = path.join(zipDir, `kanban-ai-${targetId}.zip`)
  const zip = new AdmZip()
  zip.addLocalFile(binaryPath, '')
  zip.addLocalFolder(staging.clientOut, 'client-dist')
  zip.addLocalFolder(staging.drizzleOut, 'drizzle')
  zip.writeZip(zipPath)
  console.log(`[build-binaries] packed ${zipPath}`)
  return zipPath
}

async function main() {
  console.log('[build-binaries] building client')
  await ensureClientBuild()

  console.log('[build-binaries] preparing assets')
  const staging = await prepareStaging()

  for (const target of selectedTargets) {
    console.log(`[build-binaries] compiling ${target.id}`)
    const binary = await compileBinary(target)
    await zipBinary(binary, target.id, staging)
  }
}

main().catch((error) => {
  console.error('[build-binaries] failed', error)
  process.exit(1)
})
