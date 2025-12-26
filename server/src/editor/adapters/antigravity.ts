import os from 'os'
import nodePath from 'path'
import {existsSync} from 'fs'
import {createAdapter} from './base'
import {isWSL, readWindowsEnvVar, windowsPathToWSLPath} from '../wsl'

export function collectAntigravityCommandCandidates(): string[] {
    const platform = os.platform()
    const raw = new Set<string>(['antigravity', 'antigravity.exe'])

    if (platform === 'darwin') {
        // macOS: Check common application paths
        // Note: Bundle name is speculative and not yet verified with actual installation
        raw.add('/Applications/Google Antigravity.app/Contents/MacOS/antigravity')
    } else if (platform === 'linux') {
        // Linux: Check common installation paths
        raw.add('/usr/local/bin/antigravity')
        raw.add('/usr/bin/antigravity')
        // Also check user-local installations
        const home = os.homedir()
        raw.add(nodePath.join(home, '.local', 'bin', 'antigravity'))
    } else if (platform === 'win32') {
        // Windows: Check from PATH only
        // The binary will be found via PATH extension
    }

    // WSL support: translate Windows paths to WSL paths
    if (isWSL()) {
        const localAppData = readWindowsEnvVar('LOCALAPPDATA')
        const programFiles = readWindowsEnvVar('ProgramFiles')
        const programFilesX86 = readWindowsEnvVar('ProgramFiles(x86)')

        const addWin = (winPath: string | null) => {
            if (!winPath) return
            const wslPath = windowsPathToWSLPath(winPath)
            if (wslPath) raw.add(wslPath)
        }

        // Common Windows installation paths for Antigravity
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
    
    // Filter out non-existent absolute paths (command names are kept)
    return Array.from(raw).filter((p) => !p.includes('/') || existsSync(p))
}

export const antigravityAdapter = createAdapter({
    key: 'ANTIGRAVITY',
    label: 'Google Antigravity',
    candidates: collectAntigravityCommandCandidates,
    argsFor: (path) => ['--new', path],
})
