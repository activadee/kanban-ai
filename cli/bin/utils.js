const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { spawn } = require('child_process')

function debug(...args) {
  if (process.env.KANBANAI_DEBUG) {
    console.log('[kanban-ai]', ...args)
  }
}

function isInteractive() {
  return process.stdin.isTTY && process.stdout.isTTY && !process.env.CI
}

function normalizeVersion(version) {
  const core = version.replace(/^v/, '').split('-')[0]
  return core.split('.').map((part) => Number.parseInt(part, 10) || 0)
}

function compareSemver(a, b) {
  const av = normalizeVersion(a)
  const bv = normalizeVersion(b)
  const len = Math.max(av.length, bv.length)

  for (let i = 0; i < len; i += 1) {
    const diff = (av[i] || 0) - (bv[i] || 0)
    if (diff > 0) return 1
    if (diff < 0) return -1
  }
  return 0
}

async function promptYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      const normalized = answer.trim().toLowerCase()
      resolve(normalized === '' || normalized === 'y' || normalized === 'yes')
    })
  })
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

async function download(url, dest) {
  debug('downloading', url)
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })

  if (typeof res.body.pipe === 'function') {
    const fileStream = fs.createWriteStream(dest)
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream)
      res.body.on('error', reject)
      fileStream.on('finish', resolve)
    })
  } else {
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.promises.writeFile(dest, buf)
  }
  return dest
}

module.exports = {
  debug,
  isInteractive,
  normalizeVersion,
  compareSemver,
  promptYesNo,
  run,
  pathExists,
  findInPath,
  download,
}
