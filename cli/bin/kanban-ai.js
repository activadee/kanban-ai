#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const AdmZip = require('adm-zip')
const pkg = require('../package.json')

const PLATFORM_MAP = {
  'linux:x64': { id: 'linux-x64', binary: 'kanban-ai-linux-x64' },
  'linux:arm64': { id: 'linux-arm64', binary: 'kanban-ai-linux-arm64' },
  'darwin:arm64': { id: 'darwin-arm64', binary: 'kanban-ai-darwin-arm64' },
  'win32:x64': { id: 'win-x64', binary: 'kanban-ai-win-x64.exe' },
}

const CODEX_PLATFORM_MAP = {
  'linux:x64': { vendor: 'x86_64-unknown-linux-musl', binary: 'codex' },
  'linux:arm64': { vendor: 'aarch64-unknown-linux-musl', binary: 'codex' },
  'darwin:arm64': { vendor: 'aarch64-apple-darwin', binary: 'codex' },
  'win32:x64': { vendor: 'x86_64-pc-windows-msvc', binary: 'codex.exe' },
}

const CODEX_REGISTRY = 'https://registry.npmjs.org/@openai/codex-sdk'

function debug(...args) {
  if (process.env.KANBANAI_DEBUG) {
    console.log('[kanban-ai]', ...args)
  }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function pathExists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function findInPath(binary) {
  const pathEnv = process.env.PATH || ''
  const parts = pathEnv.split(path.delimiter)
  const candidates = []

  if (process.platform === 'win32') {
    const exts = (process.env.PATHEXT || '.EXE;.BAT;.CMD').split(';')
    for (const dir of parts) {
      for (const ext of exts) {
        candidates.push(path.join(dir, binary.endsWith(ext) ? binary : `${binary}${ext.toLowerCase()}`))
      }
    }
  } else {
    for (const dir of parts) {
      candidates.push(path.join(dir, binary))
    }
  }

  return candidates.find((c) => pathExists(c))
}

async function resolveCodexVersion() {
  if (process.env.KANBANAI_CODEX_VERSION) return process.env.KANBANAI_CODEX_VERSION

  try {
    const res = await fetch(`${CODEX_REGISTRY}/latest`)
    if (res.ok) {
      const data = await res.json()
      if (data?.version) return data.version
    }
  } catch (error) {
    debug('failed to fetch codex latest version', error?.message || error)
  }

  try {
    const pkgPath = require.resolve('@openai/codex-sdk/package.json')
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const pkgJson = require(pkgPath)
    if (pkgJson?.version) return pkgJson.version
  } catch {}

  return '0.61.0'
}

function detectPlatform() {
  const key = `${process.platform}:${process.arch}`
  const mapping = PLATFORM_MAP[key]
  if (!mapping) {
    throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`)
  }
  return mapping
}

function detectCodexPlatform() {
  const key = `${process.platform}:${process.arch}`
  const mapping = CODEX_PLATFORM_MAP[key]
  if (!mapping) {
    throw new Error(`Unsupported codex platform: ${process.platform} ${process.arch}`)
  }
  return mapping
}

async function download(url, dest) {
  debug('downloading', url)
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  const fileStream = fs.createWriteStream(dest)
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream)
    res.body.on('error', reject)
    fileStream.on('finish', resolve)
  })
  return dest
}

async function ensureZip(platformId, zipName) {
  const localZip = path.join(__dirname, '..', 'dist', zipName)
  if (pathExists(localZip)) {
    debug('using packaged zip', localZip)
    return localZip
  }

  const version = process.env.KANBANAI_VERSION || pkg.version
  const tag = version.startsWith('v') ? version : `v${version}`
  const baseUrl = process.env.KANBANAI_BINARY_BASE_URL || `https://github.com/activadee/kanban-ai/releases/download/${tag}`
  const url = `${baseUrl}/${zipName}`
  const downloadDir = path.join(os.tmpdir(), 'kanban-ai', tag, platformId)
  const downloadPath = path.join(downloadDir, zipName)
  if (!pathExists(downloadPath)) {
    await download(url, downloadPath)
  } else {
    debug('using cached download', downloadPath)
  }
  return downloadPath
}

async function extract(zipPath, targetDir) {
  await fs.promises.rm(targetDir, { recursive: true, force: true })
  await fs.promises.mkdir(targetDir, { recursive: true })
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(targetDir, true)
}

async function ensureBinary() {
  const platform = detectPlatform()
  const zipName = `kanban-ai-${platform.id}.zip`
  const version = process.env.KANBANAI_VERSION || pkg.version
  const cacheRoot = process.env.KANBANAI_CACHE_DIR || path.join(os.homedir(), '.kanbanAI')
  const targetDir = path.join(cacheRoot, version, platform.id)
  const binaryPath = path.join(targetDir, platform.binary)

  if (pathExists(binaryPath)) {
    return { binaryPath, targetDir }
  }

  const zipPath = await ensureZip(platform.id, zipName)
  await extract(zipPath, targetDir)

  if (process.platform !== 'win32') {
    await fs.promises.chmod(binaryPath, 0o755)
  }

  return { binaryPath, targetDir }
}

async function ensureCodexBinary() {
  const envOverride = process.env.CODEX_PATH_OVERRIDE || process.env.CODEX_PATH
  if (envOverride && pathExists(envOverride)) {
    console.log(`[kanban-ai] codex: using override ${envOverride}`)
    return envOverride
  }

  const platform = detectCodexPlatform()
  const binaryName = platform.binary

  const fromPath = findInPath(binaryName)
  if (fromPath) {
    console.log(`[kanban-ai] codex: found on PATH at ${fromPath}`)
    return fromPath
  }

  const version = await resolveCodexVersion()
  console.log(`[kanban-ai] codex: resolved version ${version}`)
  const cacheRoot = process.env.KANBANAI_CACHE_DIR || path.join(os.homedir(), '.kanbanAI')
  const targetDir = path.join(cacheRoot, 'codex', version, platform.vendor)
  const targetBinary = path.join(targetDir, binaryName)

  if (pathExists(targetBinary)) {
    console.log(`[kanban-ai] codex: using cached binary ${targetBinary}`)
    return targetBinary
  }

  console.log(`[kanban-ai] downloading codex ${version} for ${platform.vendor}`)
  const tarballOverride = process.env.KANBANAI_CODEX_TARBALL_URL
  const tarballUrl = tarballOverride || `${CODEX_REGISTRY}/-/${encodeURIComponent('openai-codex-sdk')}-${version}.tgz`
  const downloadDir = path.join(os.tmpdir(), 'kanban-ai', 'codex', version, platform.vendor)
  const tarballPath = path.join(downloadDir, `openai-codex-sdk-${version}.tgz`)

  await fs.promises.mkdir(downloadDir, { recursive: true })

  if (!pathExists(tarballPath)) {
    await download(tarballUrl, tarballPath)
  } else {
    console.log(`[kanban-ai] codex: using cached tarball ${tarballPath}`)
  }

  const extractDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kanban-codex-'))
  await run('tar', ['-xzf', tarballPath, '-C', extractDir])

  const extractedBinary = path.join(extractDir, 'package', 'vendor', platform.vendor, 'codex', binaryName)
  if (!pathExists(extractedBinary)) {
    throw new Error(`[kanban-ai] codex binary missing in downloaded tarball for ${platform.vendor}`)
  }

  await fs.promises.mkdir(targetDir, { recursive: true })
  await fs.promises.copyFile(extractedBinary, targetBinary)
  if (process.platform !== 'win32') {
    await fs.promises.chmod(targetBinary, 0o755)
  }

  console.log(`[kanban-ai] codex: cached to ${targetBinary}`)
  return targetBinary
}

function spawnBinary(binaryPath, extractedDir, codexPath) {
  const staticDir = path.join(extractedDir, 'client-dist')
  const migrationsDir = path.join(extractedDir, 'drizzle')

  const env = {
    ...process.env,
    KANBANAI_STATIC_DIR: process.env.KANBANAI_STATIC_DIR || staticDir,
    KANBANAI_MIGRATIONS_DIR: process.env.KANBANAI_MIGRATIONS_DIR || migrationsDir,
    CODEX_PATH_OVERRIDE: process.env.CODEX_PATH_OVERRIDE || process.env.CODEX_PATH || codexPath,
  }

  const args = process.argv.slice(2)
  const child = spawn(binaryPath, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
  })

  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
  signals.forEach((sig) => {
    process.on(sig, () => {
      try {
        child.kill(sig)
      } catch {
      }
    })
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })

  child.on('error', (error) => {
    console.error('[kanban-ai] failed to start binary', error)
    process.exit(1)
  })
}

async function main() {
  try {
    const { binaryPath, targetDir } = await ensureBinary()
    const codexPath = await ensureCodexBinary()
    console.log(`[kanban-ai] codex: using ${codexPath}`)
    debug('launching binary', binaryPath)
    debug('using codex', codexPath)
    spawnBinary(binaryPath, targetDir, codexPath)
  } catch (error) {
    console.error('[kanban-ai] error', error)
    process.exit(1)
  }
}

main()
