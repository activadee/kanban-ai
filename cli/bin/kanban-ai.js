#!/usr/bin/env node
const { parseLauncherArgs } = require('./parse-args')
const { ensureBinary } = require('./binary')
const { ensureCodexBinary } = require('./codex')
const { resolveDesiredVersion } = require('./version')
const { spawnBinary } = require('./spawn-binary')
const { debug } = require('./utils')

async function main() {
  try {
    const { binaryVersion, passThrough } = parseLauncherArgs(process.argv.slice(2))

    const { version: desiredVersion, updated, baseVersion } = await resolveDesiredVersion({
      binaryVersion,
      envVersion: process.env.KANBANAI_VERSION,
    })

    let binaryPath
    let version

    try {
      const ensured = await ensureBinary(desiredVersion)
      binaryPath = ensured.binaryPath
      version = ensured.version
    } catch (error) {
      if (updated && desiredVersion !== baseVersion) {
        console.warn(`[kanban-ai] failed to download ${desiredVersion}, falling back: ${error?.message || error}`)
        const ensured = await ensureBinary(baseVersion)
        binaryPath = ensured.binaryPath
        version = ensured.version
      } else {
        throw error
      }
    }

    const codexPath = await ensureCodexBinary()
    if (updated || version !== process.env.KANBANAI_VERSION) {
      console.log(`[kanban-ai] using binary version ${version}`)
    }
    console.log(`[kanban-ai] codex: using ${codexPath}`)
    debug('launching binary', binaryPath)
    debug('using codex', codexPath)
    spawnBinary(binaryPath, codexPath, passThrough)
  } catch (error) {
    console.error('[kanban-ai] error', error)
    process.exit(1)
  }
}

main()
