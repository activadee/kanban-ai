import {spawnSync} from 'child_process'
import {readFileSync} from 'fs'
import os from 'os'
import nodePath from 'path'

export function isWSL(): boolean {
    if (process.platform !== 'linux') return false
    if (process.env.WSL_DISTRO_NAME) return true
    const release = os.release().toLowerCase()
    if (release.includes('microsoft')) return true
    try {
        const version = readFileSync('/proc/version', 'utf8').toLowerCase()
        return version.includes('microsoft')
    } catch {
        return false
    }
}

export function windowsPathToWSLPath(winPath: string): string | null {
    if (!/^[a-z]:/i.test(winPath) || winPath.length < 2) return null
    const drive = winPath.charAt(0).toLowerCase()
    const rest = winPath.slice(2).replace(/\\/g, '/').replace(/^\/+/, '')
    return `/mnt/${drive}/${rest}`
}

function parseWindowsEnvEcho(stdout: string): string | null {
    const lines = stdout.split(/\r?\n/).map((line) => line.trim())
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i]
        if (!line) continue
        if (/^%[^%]+%$/.test(line)) continue
        if (/^"?\\\\/.test(line)) continue // UNC notice paths from cmd.exe
        if (/unc/i.test(line) || /cmd\.exe/i.test(line)) continue
        return line.replace(/^"(.*)"$/, '$1')
    }
    return null
}

export function readWindowsEnvVar(name: string): string | null {
    const direct = process.env[name]
    if (direct) return direct
    if (!isWSL()) return null
    try {
        const result = spawnSync('cmd.exe', ['/c', 'echo', `%${name}%`], {encoding: 'utf8'})
        if (result.status !== 0 || !result.stdout) return null
        return parseWindowsEnvEcho(result.stdout)
    } catch {
        return null
    }
}

export function wslToWindowsPath(posixPath: string): string | null {
    if (!isWSL()) return null
    try {
        const result = spawnSync('wslpath', ['-w', posixPath], {encoding: 'utf8'})
        if (result.status === 0 && result.stdout) {
            return result.stdout.trim()
        }
    } catch {
        return null
    }
    return null
}

export function isWindowsExeOnWSL(binary: string | null): boolean {
    return Boolean(binary && process.platform === 'linux' && isWSL() && /\.exe$/i.test(binary))
}

export function normalizePathForWindowsBinary(binary: string | null, targetPath: string): string {
    if (!isWindowsExeOnWSL(binary)) return targetPath
    const converted = wslToWindowsPath(targetPath)
    return converted ?? targetPath
}

export function windowsToolboxPaths(localAppData: string | null | undefined, appName: string): string[] {
    if (!localAppData) return []
    const base = nodePath.join(localAppData, 'JetBrains', 'Toolbox', 'apps', appName)
    const wslBase = windowsPathToWSLPath(base)
    return wslBase ? [wslBase] : []
}
