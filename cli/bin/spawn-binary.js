const { spawn } = require('child_process')

function spawnBinary(binaryPath, codexPath, args) {
  const env = {
    ...process.env,
    CODEX_PATH_OVERRIDE: process.env.CODEX_PATH_OVERRIDE || process.env.CODEX_PATH || codexPath,
  }

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
      } catch {}
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

module.exports = { spawnBinary }
