import {existsSync} from 'fs'
import os from 'os'
import nodePath from 'path'
import {createAdapter} from './base'
import {isWSL, readWindowsEnvVar, windowsPathToWSLPath} from '../../utils/wsl'
import {runtimeEnv} from '../../env'

function collectZedCommandCandidates(): string[] {
    const platform = os.platform()
    const home = os.homedir()
    const raw = new Set<string>(['zed', 'zed.exe'])

    if (platform === 'darwin') {
        raw.add('/Applications/Zed.app/Contents/MacOS/zed')
        raw.add(nodePath.join(home, 'Applications', 'Zed.app', 'Contents', 'MacOS', 'zed'))
    } else if (platform === 'linux') {
        raw.add('/usr/local/bin/zed')
        raw.add('/usr/bin/zed')
        raw.add(nodePath.join(home, '.local', 'bin', 'zed'))
        if (isWSL()) {
            const username = os.userInfo().username
            const windowsUser = readWindowsEnvVar('USERNAME') ?? username
            const localAppData = readWindowsEnvVar('LOCALAPPDATA')
            const programFiles = readWindowsEnvVar('ProgramFiles')
            const programFilesX86 = readWindowsEnvVar('ProgramFiles(x86)')

            const winPaths: string[] = []
            const addWin = (path: string | null) => {
                if (!path) return
                const wslPath = windowsPathToWSLPath(path)
                if (wslPath) winPaths.push(wslPath)
            }

            const userBases = new Set<string>()
            if (windowsUser) userBases.add(windowsUser)
            if (username) userBases.add(username)
            for (const user of userBases) {
                addWin(`C:\\Users\\${user}\\AppData\\Local\\Programs\\Zed\\Zed.exe`)
                addWin(`C:\\Users\\${user}\\AppData\\Local\\Programs\\Zed\\zed.exe`)
            }

            const addProgramRoot = (root: string | null) => {
                if (!root) return
                addWin(nodePath.join(root, 'Zed', 'Zed.exe'))
                addWin(nodePath.join(root, 'Zed', 'zed.exe'))
            }

            addProgramRoot(localAppData ? nodePath.join(localAppData, 'Programs') : null)
            addProgramRoot(programFiles)
            addProgramRoot(programFilesX86)

            for (const candidate of winPaths) raw.add(candidate)
        }
    } else if (platform === 'win32') {
        const env = runtimeEnv()
        const localAppData = env.LOCALAPPDATA
        const programFiles = env.ProgramFiles
        const programFilesX86 = env['ProgramFiles(x86)']

        if (localAppData) {
            raw.add(nodePath.join(localAppData, 'Programs', 'Zed', 'Zed.exe'))
            raw.add(nodePath.join(localAppData, 'Programs', 'Zed', 'zed.exe'))
        }
        if (programFiles) {
            raw.add(nodePath.join(programFiles, 'Zed', 'Zed.exe'))
            raw.add(nodePath.join(programFiles, 'Zed', 'zed.exe'))
        }
        if (programFilesX86) {
            raw.add(nodePath.join(programFilesX86, 'Zed', 'Zed.exe'))
            raw.add(nodePath.join(programFilesX86, 'Zed', 'zed.exe'))
        }
    }

    // Keep only paths that exist when absolute, leave command names as-is
    return Array.from(raw).filter((p) => !p.includes('/') || existsSync(p))
}

export const zedAdapter = createAdapter({
    key: 'ZED',
    label: 'Zed',
    candidates: collectZedCommandCandidates,
    argsFor: (path) => ['--new', path],
})
