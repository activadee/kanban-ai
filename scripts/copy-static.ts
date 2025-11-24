import fs from 'node:fs/promises'
import path from 'node:path'

const root = new URL('..', import.meta.url)

const resolvePath = (relative: string) => path.resolve(new URL(relative, root).pathname)

async function removeDirIfExists(dir: string) {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function main() {
  const clientDist = resolvePath('client/dist')
  const serverStatic = resolvePath('server/static')

  await removeDirIfExists(serverStatic)
  await copyDir(clientDist, serverStatic)

  console.log(`[copy-static] copied ${clientDist} -> ${serverStatic}`)
}

main().catch((error) => {
  console.error('[copy-static] failed', error)
  process.exit(1)
})

