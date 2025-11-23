const fs = require('fs')
const os = require('os')
const path = require('path')
const pkg = require('../package.json')
const { PLATFORM_MAP } = require('./constants')
const { download, pathExists } = require('./utils')

function detectPlatform() {
  const key = `${process.platform}:${process.arch}`
  const mapping = PLATFORM_MAP[key]
  if (!mapping) {
    throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`)
  }
  return mapping
}

async function ensureBinary(versionOverride) {
  const platform = detectPlatform()
  const assetName = platform.binary
  const version = versionOverride || process.env.KANBANAI_VERSION || pkg.version
  process.env.KANBANAI_VERSION = version
  const skipPackaged = Boolean(versionOverride || (process.env.KANBANAI_VERSION && process.env.KANBANAI_VERSION !== pkg.version))

  const cacheRoot = process.env.KANBANAI_CACHE_DIR || path.join(os.homedir(), '.kanbanAI')
  const targetDir = path.join(cacheRoot, version, platform.id)
  const binaryPath = path.join(targetDir, assetName)

  if (pathExists(binaryPath)) {
    return { binaryPath, version }
  }

  const packaged = path.join(__dirname, '..', 'dist', assetName)
  if (!skipPackaged && pathExists(packaged)) {
    await fs.promises.mkdir(targetDir, { recursive: true })
    await fs.promises.copyFile(packaged, binaryPath)
    if (process.platform !== 'win32') {
      await fs.promises.chmod(binaryPath, 0o755)
    }
    return { binaryPath, version }
  }

  const tag = version.startsWith('v') ? version : `v${version}`
  const baseUrl = process.env.KANBANAI_BINARY_BASE_URL || `https://github.com/activadee/kanban-ai/releases/download/${tag}`
  const url = `${baseUrl}/${assetName}`
  const downloadPath = path.join(os.tmpdir(), 'kanban-ai', tag, platform.id, assetName)

  console.log(`[kanban-ai] downloading ${assetName} (${version})`)
  await download(url, downloadPath)

  await fs.promises.mkdir(targetDir, { recursive: true })
  await fs.promises.copyFile(downloadPath, binaryPath)
  if (process.platform !== 'win32') {
    await fs.promises.chmod(binaryPath, 0o755)
  }

  return { binaryPath, version }
}

module.exports = { detectPlatform, ensureBinary }
