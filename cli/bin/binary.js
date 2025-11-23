const fs = require('fs')
const os = require('os')
const path = require('path')
const AdmZip = require('adm-zip')
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
  const zipName = platform.zip
  const envVersion = process.env.KANBANAI_VERSION
  const version = versionOverride ?? envVersion ?? pkg.version
  process.env.KANBANAI_VERSION = version
  const skipPackaged = Boolean(
    (versionOverride && versionOverride !== pkg.version) ||
    (envVersion && envVersion !== pkg.version),
  )

  const cacheRoot = process.env.KANBANAI_CACHE_DIR || path.join(os.homedir(), '.kanbanAI')
  const targetDir = path.join(cacheRoot, version, platform.id)
  const binaryPath = path.join(targetDir, assetName)

  if (pathExists(binaryPath)) {
    return { binaryPath, version }
  }

  // Prefer packaged zip inside the published npm tarball (mirrors vibe-kanban flow)
  const packagedZip = path.join(__dirname, '..', 'dist', platform.id, zipName)
  const packagedBinary = path.join(__dirname, '..', 'dist', assetName)

  const tryExtractZip = async (zipPath) => {
    await fs.promises.mkdir(targetDir, { recursive: true })
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(targetDir, true)
    const extracted = path.join(targetDir, assetName)
    if (!pathExists(extracted)) {
      throw new Error(`zip did not contain expected binary (${assetName})`)
    }
    if (process.platform !== 'win32') {
      await fs.promises.chmod(extracted, 0o755)
    }
    return extracted
  }

  if (!skipPackaged && pathExists(packagedZip)) {
    const extracted = await tryExtractZip(packagedZip)
    return { binaryPath: extracted, version }
  }

  if (!skipPackaged && pathExists(packagedBinary)) {
    await fs.promises.mkdir(targetDir, { recursive: true })
    await fs.promises.copyFile(packagedBinary, binaryPath)
    if (process.platform !== 'win32') {
      await fs.promises.chmod(binaryPath, 0o755)
    }
    return { binaryPath, version }
  }

  if (process.env.KANBANAI_OFFLINE) {
    throw new Error('offline mode enabled and packaged binary not found')
  }

  const tag = version.startsWith('v') ? version : `v${version}`
  const baseUrl = process.env.KANBANAI_BINARY_BASE_URL || `https://github.com/activadee/kanban-ai/releases/download/${tag}`
  const url = `${baseUrl}/${zipName}`
  const downloadPath = path.join(os.tmpdir(), 'kanban-ai', tag, platform.id, zipName)

  console.log(`[kanban-ai] downloading ${zipName} (${version})`)
  try {
    await download(url, downloadPath)
    await fs.promises.mkdir(targetDir, { recursive: true })
    const extracted = await tryExtractZip(downloadPath)
    return { binaryPath: extracted, version }
  } catch (error) {
    console.warn(`[kanban-ai] failed to download zip (${error?.message || error}), trying raw binary`)
  }

  const binaryUrl = `${baseUrl}/${assetName}`
  const binaryDownloadPath = path.join(os.tmpdir(), 'kanban-ai', tag, platform.id, assetName)
  console.log(`[kanban-ai] downloading ${assetName} (${version})`)
  await download(binaryUrl, binaryDownloadPath)
  await fs.promises.mkdir(targetDir, { recursive: true })
  await fs.promises.copyFile(binaryDownloadPath, binaryPath)
  if (process.platform !== 'win32') {
    await fs.promises.chmod(binaryPath, 0o755)
  }

  return { binaryPath, version }
}

module.exports = { detectPlatform, ensureBinary }
