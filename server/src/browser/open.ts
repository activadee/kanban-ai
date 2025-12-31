import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'

/**
 * Detects if running inside WSL (Windows Subsystem for Linux).
 */
function isWSL(): boolean {
  // Check environment variables set by WSL
  if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
    return true
  }

  // Check /proc/version for Microsoft/WSL indicators
  try {
    if (existsSync('/proc/version')) {
      const version = readFileSync('/proc/version', 'utf8').toLowerCase()
      return version.includes('microsoft') || version.includes('wsl')
    }
  } catch {
    // Ignore errors
  }

  return false
}

/**
 * Opens a URL in the system's default browser.
 * Works cross-platform: macOS, Linux, Windows, and WSL.
 */
export function openBrowser(url: string): boolean {
  const platform = process.platform

  let command: string
  let args: string[]

  if (platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else if (isWSL()) {
    // In WSL, use wslview (from wslu) or fallback to explorer.exe
    // wslview is the recommended way to open URLs in Windows from WSL
    command = 'wslview'
    args = [url]
  } else {
    // Linux and other Unix-like systems
    command = 'xdg-open'
    args = [url]
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
