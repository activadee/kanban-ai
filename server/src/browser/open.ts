import { spawn } from 'child_process'

/**
 * Opens a URL in the system's default browser.
 * Works cross-platform: macOS, Linux, and Windows.
 */
export function openBrowser(url: string): boolean {
  const platform = process.platform

  let command: string
  let args: string[]

  switch (platform) {
    case 'darwin':
      command = 'open'
      args = [url]
      break
    case 'win32':
      command = 'cmd'
      args = ['/c', 'start', '', url]
      break
    default:
      // Linux and other Unix-like systems
      command = 'xdg-open'
      args = [url]
      break
  }

  try {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
    })
    child.unref()
    return true
  } catch {
    return false
  }
}
