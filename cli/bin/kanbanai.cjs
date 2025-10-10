#!/usr/bin/env node
/* Runner wrapper — resolves platform-specific binary in dist/ and executes it. */
const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

function resolveBinary() {
  const root = join(__dirname, '..', '..')
  const plat = process.platform
  const arch = process.arch
  const candidates = []
  if (plat === 'linux' && arch === 'x64') candidates.push(join(root, 'dist', 'kanbanai-linux-x64'))
  if (plat === 'linux' && arch === 'arm64') candidates.push(join(root, 'dist', 'kanbanai-linux-arm64'))
  if (plat === 'darwin' && arch === 'x64') candidates.push(join(root, 'dist', 'kanbanai-darwin-x64'))
  if (plat === 'darwin' && arch === 'arm64') candidates.push(join(root, 'dist', 'kanbanai-darwin-arm64'))
  if (plat === 'win32' && arch === 'x64') candidates.push(join(root, 'dist', 'kanbanai-windows-x64.exe'))
  if (plat === 'win32' && arch === 'arm64') candidates.push(join(root, 'dist', 'kanbanai-windows-arm64.exe'))
  // Fallback generic
  candidates.push(join(root, 'dist', 'kanbanai'))
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

function run() {
  const bin = resolveBinary()
  if (!bin) {
    const pairs = 'linux-x64, linux-arm64, darwin-x64, darwin-arm64, win32-x64, win32-arm64'
    console.error(`[kanban-ai] binary not found for platform ${process.platform}-${process.arch}.`)
    console.error(`[kanban-ai] Supported targets: ${pairs}`)
    console.error('[kanban-ai] Ensure dist/ contains a matching binary. Build with `bun run package` or install a platform release.')
    process.exit(1)
  }
  const args = process.argv.slice(2)
  const child = spawn(bin, args, { stdio: 'inherit' })
  const forward = (sig) => { try { child.kill(sig) } catch {} }
  process.on('SIGINT', () => forward('SIGINT'))
  process.on('SIGTERM', () => forward('SIGTERM'))
  child.on('exit', (code, signal) => {
    if (signal) process.exit(1)
    else process.exit(code == null ? 0 : code)
  })
}

run()

