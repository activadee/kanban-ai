import os from 'os'
import nodePath from 'path'
import {createAdapter} from './base'
import {currentWSLDistroName, isWSL, readWindowsEnvVar, windowsPathToWSLPath} from '../../utils/wsl'

function collectVSCodeCommandCandidates(): string[] {
    const platform = os.platform()
    const raw = new Set<string>(['code', 'code.exe', 'code.cmd', 'code-insiders', 'code-insiders.exe', 'code-insiders.cmd'])

    if (platform === 'darwin') {
        raw.add('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')
    }

    if (platform === 'linux' && isWSL()) {
        const localAppData = readWindowsEnvVar('LOCALAPPDATA')
        const programFiles = readWindowsEnvVar('ProgramFiles') || 'C\\Program Files'
        const programFilesX86 = readWindowsEnvVar('ProgramFiles(x86)') || 'C\\Program Files (x86)'

        const addWin = (winPath: string | null) => {
            const wsl = winPath ? windowsPathToWSLPath(winPath) : null
            if (wsl) raw.add(wsl)
        }

        if (localAppData) {
            addWin(nodePath.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'))
            addWin(nodePath.join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'))
        }
        addWin(nodePath.join(programFiles, 'Microsoft VS Code', 'Code.exe'))
        addWin(nodePath.join(programFilesX86, 'Microsoft VS Code', 'Code.exe'))
        addWin(nodePath.join(programFiles, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'))
        addWin(nodePath.join(programFilesX86, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'))
    }

    return Array.from(raw)
}

export const vsCodeAdapter = createAdapter({
    key: 'VS_CODE',
    label: 'VS Code',
    candidates: collectVSCodeCommandCandidates,
    // -n forces a new window instead of reusing the existing one
    argsFor: (path, bin) => {
        if (isWSL() && /\.exe$/i.test(bin)) {
            const distro = currentWSLDistroName() || 'wsl'
            return ['-n', '--remote', `wsl+${distro}`, path]
        }
        return ['-n', path]
    },
    // Keep WSL paths when launching Windows Code with Remote WSL; Windows path conversion would break it
    transformPath: (path, bin) => {
        if (isWSL() && /\.exe$/i.test(bin)) return path
        return path
    },
})
