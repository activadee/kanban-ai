const fs = require('fs')
const os = require('os')
const path = require('path')
const { CODEX_PLATFORM_MAP, CODEX_REGISTRY } = require('./constants')
const { download, findInPath, pathExists, run } = require('./utils')

function detectCodexPlatform() {
  const key = `${process.platform}:${process.arch}`
  const mapping = CODEX_PLATFORM_MAP[key]
  if (!mapping) {
    throw new Error(`Unsupported codex platform: ${process.platform} ${process.arch}`)
  }
  return mapping
}

async function resolveCodexVersion() {
  if (process.env.KANBANAI_CODEX_VERSION) return process.env.KANBANAI_CODEX_VERSION

  try {
    const res = await fetch(`${CODEX_REGISTRY}/latest`)
    if (res.ok) {
      const data = await res.json()
      if (data?.version) return data.version
    }
  } catch {}

  try {
    const pkgPath = require.resolve('@openai/codex-sdk/package.json')
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const pkgJson = require(pkgPath)
    if (pkgJson?.version) return pkgJson.version
  } catch {}

  return '0.63.0'
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

module.exports = { detectCodexPlatform, ensureCodexBinary, resolveCodexVersion }
