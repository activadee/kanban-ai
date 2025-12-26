import os from 'os'
import nodePath from 'path'
import {existsSync} from 'fs'
import {createAdapter} from './base'
import {isWSL, readWindowsEnvVar, normalizePathForWindowsBinary, windowsPathToWSLPath} from '../wsl'

export function collectAntigravityCommandCandidates(): string[] {
    const platform = os.platform()
    const raw = new Set<string>(['antigravity', 'antigravity.exe', 'Antigravity.exe'])

    if (platform === 'darwin') {
        raw.add('/Applications/Google Antigravity.app/Contents/MacOS/antigravity')
    } else if (platform === 'linux') {
        raw.add('/usr/local/bin/antigravity')
        raw.add('/usr/bin/antigravity')
        const home = os.homedir()
        raw.add(nodePath.join(home, '.local', 'bin', 'antigravity'))
    } else if (platform === 'win32') {
    }

    if (isWSL()) {
        const localAppData = readWindowsEnvVar('LOCALAPPDATA')
        const programFiles = readWindowsEnvVar('ProgramFiles')
        const programFilesX86 = readWindowsEnvVar('ProgramFiles(x86)')

        const addWin = (winPath: string | null) => {
            if (!winPath) return
            const wslPath = windowsPathToWSLPath(winPath)
            if (wslPath) raw.add(wslPath)
        }

        if (localAppData) {
            addWin(nodePath.join(localAppData, 'Programs', 'Antigravity', 'antigravity.exe'))
            addWin(nodePath.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'))
        }
        if (programFiles) {
            addWin(nodePath.join(programFiles, 'Antigravity', 'antigravity.exe'))
            addWin(nodePath.join(programFiles, 'Antigravity', 'Antigravity.exe'))
        }
        if (programFilesX86) {
            addWin(nodePath.join(programFilesX86, 'Antigravity', 'antigravity.exe'))
            addWin(nodePath.join(programFilesX86, 'Antigravity', 'Antigravity.exe'))
        }
    }
    
    return Array.from(raw).filter((p) => !p.includes('/') || existsSync(p))
}

export const antigravityAdapter = createAdapter({
    key: 'ANTIGRAVITY',
    label: 'Google Antigravity',
    candidates: collectAntigravityCommandCandidates,
    argsFor: (path) => ['--new', path],
    // Keep Antigravity Windows paths when launching in WSL; Windows path conversion would break it
    transformPath: (path, bin) => {
        if (isWSL() && /\.exe$/i.test(bin)) return path
        return normalizePathForWindowsBinary(bin, path)
    },
})
