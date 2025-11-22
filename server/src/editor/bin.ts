import {spawnSync} from 'child_process'
import {existsSync} from 'fs'

export function which(cmd: string): string | null {
    if (cmd.includes('/') || cmd.includes('\\')) {
        return existsSync(cmd) ? cmd : null
    }
    try {
        const bunResult = Bun.which(cmd)
        if (bunResult) {
            return String(bunResult)
        }
    } catch {
        // ignore and try platform-specific lookup below
    }
    try {
        const detector = process.platform === 'win32' ? 'where' : 'which'
        const result = spawnSync(detector, [cmd], {encoding: 'utf8', windowsHide: true})
        if (result.status === 0 && result.stdout) {
            const match = result.stdout.split(/\r?\n/).find((line) => line.trim().length > 0)
            if (match) {
                return match.trim()
            }
        }
    } catch {
        // fall back to null
    }
    return null
}

export function pickBinary(candidates: string[]): string | null {
    for (const name of candidates) {
        const resolved = which(name)
        if (resolved) {
            return resolved
        }
    }
    return null
}
