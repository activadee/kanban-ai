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

function debug(...args) {
  if (process.env.KANBANAI_DEBUG) {
    console.log('[kanban-ai]', ...args)
  }
}

function pathExists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function detectPlatform() {
  const key = `${process.platform}:${process.arch}`
  const mapping = PLATFORM_MAP[key]
  if (!mapping) {
    throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`)
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
  const cacheRoot = process.env.KANBANAI_CACHE_DIR || path.join(os.homedir(), '.kanban-ai')
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

function spawnBinary(binaryPath, extractedDir) {
  const staticDir = path.join(extractedDir, 'client-dist')
  const migrationsDir = path.join(extractedDir, 'drizzle')

  const env = {
    ...process.env,
    KANBANAI_STATIC_DIR: process.env.KANBANAI_STATIC_DIR || staticDir,
    KANBANAI_MIGRATIONS_DIR: process.env.KANBANAI_MIGRATIONS_DIR || migrationsDir,
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
    debug('launching binary', binaryPath)
    spawnBinary(binaryPath, targetDir)
  } catch (error) {
    console.error('[kanban-ai] error', error)
    process.exit(1)
  }
}

main()
