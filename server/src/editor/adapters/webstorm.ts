import {existsSync, readdirSync} from 'fs'
import os from 'os'
import nodePath from 'path'
import {createAdapter} from './base'
import {isWSL, readWindowsEnvVar, windowsPathToWSLPath, windowsToolboxPaths} from '../../utils/wsl'
import {runtimeEnv} from '../../env'

function safeSubdirs(dir: string | null | undefined): string[] {
    if (!dir) return []
    try {
        return readdirSync(dir, {withFileTypes: true})
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
    } catch {
        return []
    }
}

function collectJetBrainsToolboxInstalls(appName: string): string[] {
    const platform = os.platform()
    const home = os.homedir()
    const bases: string[] = []
    if (platform === 'darwin') {
        bases.push(nodePath.join(home, 'Library', 'Application Support', 'JetBrains', 'Toolbox', 'apps', appName))
    } else if (platform === 'linux') {
        bases.push(nodePath.join(home, '.local', 'share', 'JetBrains', 'Toolbox', 'apps', appName))
    } else if (platform === 'win32') {
        const localAppData = runtimeEnv().LOCALAPPDATA
        if (localAppData) {
            bases.push(nodePath.join(localAppData, 'JetBrains', 'Toolbox', 'apps', appName))
        }
    }

    const installs: string[] = []
    for (const base of bases) {
        for (const channel of safeSubdirs(base)) {
            const channelDir = nodePath.join(base, channel)
            for (const build of safeSubdirs(channelDir)) {
                installs.push(nodePath.join(channelDir, build))
            }
        }
    }
    return installs
}

function collectWebStormToolboxBinaries(): string[] {
    const platform = os.platform()
    const installs = collectJetBrainsToolboxInstalls('WebStorm')
    const binaries: string[] = []
    for (const install of installs) {
        if (platform === 'darwin') {
            const candidate = nodePath.join(install, 'WebStorm.app', 'Contents', 'MacOS', 'webstorm')
            if (existsSync(candidate)) binaries.push(candidate)
        } else if (platform === 'linux') {
            const candidate = nodePath.join(install, 'WebStorm', 'bin', 'webstorm.sh')
            if (existsSync(candidate)) binaries.push(candidate)
        } else if (platform === 'win32') {
            const exe64 = nodePath.join(install, 'bin', 'webstorm64.exe')
            const exe = nodePath.join(install, 'bin', 'webstorm.exe')
            if (existsSync(exe64)) binaries.push(exe64)
            if (existsSync(exe)) binaries.push(exe)
        }
    }
    return binaries
}

function collectWindowsWebStormProgramBinaries(): string[] {
    if (os.platform() !== 'win32') return []
    const roots = new Set<string>()
    const env = runtimeEnv()
    const programFiles = env.ProgramFiles
    const programFilesX86 = env['ProgramFiles(x86)']
    if (programFiles) roots.add(nodePath.join(programFiles, 'JetBrains'))
    if (programFilesX86) roots.add(nodePath.join(programFilesX86, 'JetBrains'))

    const binaries: string[] = []
    for (const root of roots) {
        for (const entry of safeSubdirs(root)) {
            if (!entry.toLowerCase().startsWith('webstorm')) continue
            const base = nodePath.join(root, entry)
            const exe64 = nodePath.join(base, 'bin', 'webstorm64.exe')
            const exe = nodePath.join(base, 'bin', 'webstorm.exe')
            if (existsSync(exe64)) binaries.push(exe64)
            if (existsSync(exe)) binaries.push(exe)
        }
    }
    return binaries
}

function collectLinuxWebStormBinaries(): string[] {
    if (os.platform() !== 'linux') return []
    const home = os.homedir()
    const bases = [
        '/opt',
        nodePath.join(home, 'Applications'),
        nodePath.join(home, 'JetBrains'),
        nodePath.join(home, '.local', 'share', 'JetBrains'),
    ]
    const binaries: string[] = []
    const addBin = (dir: string) => {
        const script = nodePath.join(dir, 'bin', 'webstorm.sh')
        if (existsSync(script)) binaries.push(script)
    }
    for (const base of bases) {
        for (const entry of safeSubdirs(base)) {
            const lower = entry.toLowerCase()
            if (lower.startsWith('webstorm')) {
                addBin(nodePath.join(base, entry))
                continue
            }
            if (lower.includes('jetbrains')) {
                const nestedBase = nodePath.join(base, entry)
                for (const nested of safeSubdirs(nestedBase)) {
                    if (nested.toLowerCase().startsWith('webstorm')) {
                        addBin(nodePath.join(nestedBase, nested))
                    }
                }
            }
        }
    }
    return binaries
}

function collectWebStormCommandCandidates(): string[] {
    const platform = os.platform()
    const home = os.homedir()
    const raw = new Set<string>([
        'webstorm',
        'webstorm.sh',
        'webstorm.exe',
        'webstorm64.exe',
        'wstorm',
        'wstorm.exe',
        'wstorm64.exe',
        'jetbrains-webstorm',
    ])

    if (platform === 'darwin') {
        raw.add('/Applications/WebStorm.app/Contents/MacOS/webstorm')
        raw.add(nodePath.join(home, 'Applications', 'WebStorm.app', 'Contents', 'MacOS', 'webstorm'))
        raw.add(nodePath.join(home, 'Applications', 'JetBrains Toolbox', 'WebStorm.app', 'Contents', 'MacOS', 'webstorm'))
    }

    if (platform === 'linux') {
        raw.add('/opt/WebStorm/bin/webstorm.sh')
        raw.add('/opt/JetBrains/WebStorm/bin/webstorm.sh')
        raw.add(nodePath.join(home, 'WebStorm', 'bin', 'webstorm.sh'))
        if (isWSL()) {
            const localAppData = readWindowsEnvVar('LOCALAPPDATA')
            const programFiles = readWindowsEnvVar('ProgramFiles') || 'C\\Program Files'
            const programFilesX86 = readWindowsEnvVar('ProgramFiles(x86)') || 'C\\Program Files (x86)'
            const winPaths = [
                nodePath.join(programFiles, 'JetBrains', 'WebStorm', 'bin', 'webstorm64.exe'),
                nodePath.join(programFiles, 'JetBrains', 'WebStorm', 'bin', 'webstorm.exe'),
                nodePath.join(programFilesX86, 'JetBrains', 'WebStorm', 'bin', 'webstorm64.exe'),
                nodePath.join(programFilesX86, 'JetBrains', 'WebStorm', 'bin', 'webstorm.exe'),
            ]
            const toolboxBases = windowsToolboxPaths(localAppData, 'WebStorm')
            for (const toolboxBase of toolboxBases) {
                for (const channel of safeSubdirs(toolboxBase)) {
                    const channelDir = nodePath.join(toolboxBase, channel)
                    for (const build of safeSubdirs(channelDir)) {
                        const base = nodePath.join(channelDir, build)
                        const exe64 = nodePath.join(base, 'bin', 'webstorm64.exe')
                        const exe = nodePath.join(base, 'bin', 'webstorm.exe')
                        if (existsSync(exe64)) raw.add(exe64)
                        if (existsSync(exe)) raw.add(exe)
                    }
                }
            }
            for (const winPath of winPaths) {
                const wsl = windowsPathToWSLPath(winPath)
                if (wsl) raw.add(wsl)
            }
        }
    }

    if (platform === 'win32') {
        const env = runtimeEnv()
        const defaultProgramFiles = env.ProgramFiles || 'C\\Program Files'
        const defaultProgramFilesX86 = env['ProgramFiles(x86)'] || 'C\\Program Files (x86)'
        raw.add(nodePath.join(defaultProgramFiles, 'JetBrains', 'WebStorm', 'bin', 'webstorm64.exe'))
        raw.add(nodePath.join(defaultProgramFiles, 'JetBrains', 'WebStorm', 'bin', 'webstorm.exe'))
        raw.add(nodePath.join(defaultProgramFilesX86, 'JetBrains', 'WebStorm', 'bin', 'webstorm64.exe'))
        raw.add(nodePath.join(defaultProgramFilesX86, 'JetBrains', 'WebStorm', 'bin', 'webstorm.exe'))
    }

    for (const candidate of collectWebStormToolboxBinaries()) raw.add(candidate)
    if (platform === 'win32') {
        for (const candidate of collectWindowsWebStormProgramBinaries()) raw.add(candidate)
    }
    if (platform === 'linux') {
        for (const candidate of collectLinuxWebStormBinaries()) raw.add(candidate)
    }

    return Array.from(raw)
}

export const webStormAdapter = createAdapter({
    key: 'WEBSTORM',
    label: 'WebStorm',
    candidates: collectWebStormCommandCandidates,
    argsFor: (path) => [path],
})
