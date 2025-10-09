import {spawn, spawnSync} from 'child_process'
import {existsSync, readdirSync} from 'fs'
import os from 'os'
import nodePath from 'path'
import {settingsService} from 'core'

export type ExecSpec = { cmd: string; args: string[]; line: string }
export type EditorKey =
    | 'VS_CODE'
    | 'CODE_INSIDERS'
    | 'VSCODIUM'
    | 'CURSOR'
    | 'WINDSURF'
    | 'ZED'
    | 'INTELLIJ'
    | 'WEBSTORM'
    | 'XCODE'
    | 'SYSTEM'
    | 'CUSTOM'
export type EditorInfo = { key: EditorKey; label: string; installed: boolean; bin?: string }

const PATH_EXT = '/usr/local/bin:/usr/bin:/bin:/snap/bin:/var/lib/snapd/snap/bin'
const SHELL_CANDIDATES = ['bash', 'zsh', 'sh']

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
        const localAppData = process.env.LOCALAPPDATA
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
    const programFiles = process.env.ProgramFiles
    const programFilesX86 = process.env['ProgramFiles(x86)']
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
    }

    if (platform === 'win32') {
        const defaultProgramFiles = process.env.ProgramFiles || 'C:\\Program Files'
        const defaultProgramFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
        raw.add(nodePath.join(defaultProgramFiles, 'JetBrains', 'WebStorm', 'bin', 'webstorm64.exe'))
        raw.add(nodePath.join(defaultProgramFiles, 'JetBrains', 'WebStorm', 'bin', 'webstorm.exe'))
        raw.add(nodePath.join(defaultProgramFilesX86, 'JetBrains', 'WebStorm', 'bin', 'webstorm64.exe'))
        raw.add(nodePath.join(defaultProgramFilesX86, 'JetBrains', 'WebStorm', 'bin', 'webstorm.exe'))
    }

    for (const candidate of collectWebStormToolboxBinaries()) {
        raw.add(candidate)
    }
    if (platform === 'win32') {
        for (const candidate of collectWindowsWebStormProgramBinaries()) {
            raw.add(candidate)
        }
    }
    if (platform === 'linux') {
        for (const candidate of collectLinuxWebStormBinaries()) {
            raw.add(candidate)
        }
    }

    return Array.from(raw)
}

function which(cmd: string): string | null {
    if (cmd.includes('/') || cmd.includes('\\')) {
        return existsSync(cmd) ? cmd : null
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bunResult = (Bun as any)?.which?.(cmd)
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

function pickBinary(candidates: string[]): string | null {
    for (const name of candidates) {
        const resolved = which(name)
        if (resolved) {
            return resolved
        }
    }
    return null
}

function formatCommandLine(cmd: string, args: string[]): string {
    const parts = [cmd, ...args]
    return parts
        .map((part) => {
            if (part.length === 0) return '""'
            if (/\s|"|\\/.test(part)) {
                return JSON.stringify(part)
            }
            return part
        })
        .join(' ')
}

function createDesktopEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: process.env.PATH ? `${process.env.PATH}:${PATH_EXT}` : PATH_EXT,
    }
    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
    const runtimeDir = uid !== undefined ? `/run/user/${uid}` : undefined
    if (!env.XDG_RUNTIME_DIR && runtimeDir && existsSync(runtimeDir)) {
        env.XDG_RUNTIME_DIR = runtimeDir
    }
    if (!env.DBUS_SESSION_BUS_ADDRESS && runtimeDir && existsSync(`${runtimeDir}/bus`)) {
        env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${runtimeDir}/bus`
    }
    if (!env.DISPLAY && process.platform !== 'win32') {
        env.DISPLAY = ':0'
    }
    return env
}

function trySpawnDetached(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    onFailure?: () => void,
): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bunSpawn = (Bun as any)?.spawn as
        | ((options: { cmd: string[]; env?: NodeJS.ProcessEnv; stdout?: string; stderr?: string; stdin?: string }) => {
        unref?: () => void
        exited: Promise<number>
    })
        | undefined

    if (typeof bunSpawn === 'function') {
        try {
            const proc = bunSpawn({cmd: [command, ...args], env, stdout: 'ignore', stderr: 'ignore', stdin: 'ignore'})
            if (typeof proc.unref === 'function') proc.unref()
            if (onFailure) {
                proc.exited.then((code: number) => {
                    if (code !== 0) onFailure()
                }).catch(() => onFailure())
            }
            return true
        } catch {
            // fall through to Node.js spawn below
        }
    }

    try {
        const child = spawn(command, args, {
            env,
            stdio: 'ignore',
            detached: true,
            windowsHide: process.platform === 'win32',
        })
        child.unref()
        if (onFailure) {
            child.once('error', () => onFailure())
            child.once('exit', (code) => {
                if (typeof code === 'number' && code !== 0) onFailure()
            })
        }
        return true
    } catch {
        if (onFailure) onFailure()
        return false
    }
}

function runShellCommand(line: string, env: NodeJS.ProcessEnv): ExecSpec {
    const platform = os.platform()
    if (platform === 'win32') {
        const args = ['/c', 'start', '', line]
        trySpawnDetached('cmd.exe', args, env)
        return {cmd: 'cmd.exe', args, line}
    }
    const shell = pickBinary(SHELL_CANDIDATES) || '/bin/sh'
    const script = `nohup ${line} >/dev/null 2>&1 & disown`
    const args = ['-lc', script]
    trySpawnDetached(shell, args, env)
    return {cmd: shell, args, line}
}

function resolveDirectSpec(path: string, key: EditorKey, custom?: string): ExecSpec | null {
    const mk = (bin: string | null, args: string[]): ExecSpec | null => {
        if (!bin) return null
        return {cmd: bin, args, line: formatCommandLine(bin, args)}
    }
    switch (key) {
        case 'VS_CODE':
            return mk(pickBinary(['code', 'code.cmd', 'code.exe', 'codium', 'code-insiders']), ['-r', path])
        case 'CODE_INSIDERS':
            return mk(pickBinary(['code-insiders', 'code-insiders.cmd', 'code-insiders.exe']), ['-r', path])
        case 'VSCODIUM':
            return mk(pickBinary(['codium', 'codium.cmd']), ['-r', path])
        case 'CURSOR':
            return mk(pickBinary(['cursor', 'cursor.exe']), ['-r', path])
        case 'WINDSURF':
            return mk(pickBinary(['windsurf', 'windsurf.exe']), [path])
        case 'ZED':
            return mk(pickBinary(['zed', 'zed.exe']), ['--new', path])
        case 'WEBSTORM': {
            const candidates = collectWebStormCommandCandidates()
            const resolved = pickBinary(candidates)
            if (resolved) return mk(resolved, [path])
            if (os.platform() === 'darwin') {
                return mk(pickBinary(['open']), ['-a', 'WebStorm', path])
            }
            return mk(null, [])
        }
        case 'INTELLIJ':
            return mk(pickBinary(['idea', 'idea.sh', 'idea64.exe', 'intellij-idea-community', 'intellij-idea-ultimate']), [path])
        case 'XCODE':
            if (os.platform() === 'darwin') {
                const xed = pickBinary(['xed'])
                if (xed) return mk(xed, ['-b', path])
                return mk(pickBinary(['open']), [path])
            }
            return null
        case 'SYSTEM':
            if (os.platform() === 'win32') return mk(pickBinary(['explorer.exe', 'explorer']), [path])
            if (os.platform() === 'darwin') return mk(pickBinary(['open']), [path])
            return mk(pickBinary(['xdg-open']), [path])
        case 'CUSTOM':
            if (custom) {
                const replaced = custom.replaceAll('{path}', JSON.stringify(path))
                return {cmd: replaced, args: [], line: replaced}
            }
            return null
        default:
            return null
    }
}

function buildFallbackLine(path: string, key: EditorKey, custom?: string): string {
    if (key === 'CUSTOM' && custom) {
        return custom.replaceAll('{path}', JSON.stringify(path))
    }
    switch (key) {
        case 'VS_CODE':
            return formatCommandLine(pickBinary(['code', 'code.cmd', 'code.exe']) || 'code', ['-r', path])
        case 'CODE_INSIDERS':
            return formatCommandLine(pickBinary(['code-insiders', 'code-insiders.cmd', 'code-insiders.exe']) || 'code-insiders', ['-r', path])
        case 'VSCODIUM':
            return formatCommandLine(pickBinary(['codium', 'codium.cmd']) || 'codium', ['-r', path])
        case 'CURSOR':
            return formatCommandLine(pickBinary(['cursor', 'cursor.exe']) || 'cursor', ['-r', path])
        case 'WINDSURF':
            return formatCommandLine(pickBinary(['windsurf', 'windsurf.exe']) || 'windsurf', [path])
        case 'ZED':
            return formatCommandLine(pickBinary(['zed', 'zed.exe']) || 'zed', ['--new', path])
        case 'WEBSTORM': {
            const resolved = pickBinary(collectWebStormCommandCandidates())
            if (resolved) return formatCommandLine(resolved, [path])
            if (os.platform() === 'darwin') {
                return formatCommandLine(pickBinary(['open']) || 'open', ['-a', 'WebStorm', path])
            }
            if (os.platform() === 'win32') {
                return formatCommandLine('webstorm64.exe', [path])
            }
            return formatCommandLine('webstorm', [path])
        }
        case 'INTELLIJ':
            return formatCommandLine(
                pickBinary(['idea', 'idea.sh', 'idea64.exe', 'intellij-idea-community', 'intellij-idea-ultimate']) || 'idea',
                [path],
            )
        case 'XCODE':
            if (os.platform() === 'darwin') {
                const xed = pickBinary(['xed'])
                if (xed) return formatCommandLine(xed, ['-b', path])
                return formatCommandLine('open', [path])
            }
            return formatCommandLine('open', [path])
        case 'SYSTEM':
            if (os.platform() === 'win32') return formatCommandLine('explorer.exe', [path])
            if (os.platform() === 'darwin') return formatCommandLine('open', [path])
            return formatCommandLine(pickBinary(['xdg-open']) || 'xdg-open', [path])
        default:
            if (os.platform() === 'win32') return formatCommandLine('explorer.exe', [path])
            if (os.platform() === 'darwin') return formatCommandLine('open', [path])
            return formatCommandLine(pickBinary(['xdg-open']) || 'xdg-open', [path])
    }
}

function loadUserSessionEnv(): Record<string, string> | null {
    if (process.platform !== 'linux') return null
    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
    if (uid === undefined) return null
    try {
        const result = spawnSync('systemctl', ['--user', 'show-environment'], {
            encoding: 'utf8',
            windowsHide: true,
        })
        if (result.status !== 0 || !result.stdout) return null
        const env: Record<string, string> = {}
        for (const line of result.stdout.split(/\r?\n/)) {
            if (!line) continue
            const idx = line.indexOf('=')
            if (idx === -1) continue
            const key = line.slice(0, idx)
            const value = line.slice(idx + 1)
            if (key) env[key] = value
        }
        return env
    } catch {
        return null
    }
}

export async function openEditorAtPath(path: string, opts?: {
    editorKey?: EditorKey;
    customCommand?: string
}): Promise<{ spec: ExecSpec; env: NodeJS.ProcessEnv }> {
    const settings = settingsService.snapshot()
    const key = opts?.editorKey ?? (settings.editorType as EditorKey)
    const custom = opts?.customCommand ?? settings.editorCommand ?? undefined
    const env = {...createDesktopEnv()}
    const sessionEnv = loadUserSessionEnv()
    if (sessionEnv) {
        for (const [k, v] of Object.entries(sessionEnv)) {
            if (env[k] == null && v != null) {
                env[k] = v
            }
        }
    }
    const runtimeDir = env.XDG_RUNTIME_DIR || (typeof process.getuid === 'function' ? `/run/user/${process.getuid()}` : undefined)
    if (!env.WAYLAND_DISPLAY && runtimeDir) {
        const waylandSock = `${runtimeDir}/wayland-0`
        if (existsSync(waylandSock)) {
            env.WAYLAND_DISPLAY = 'wayland-0'
        }
    }
    if (!env.DBUS_SESSION_BUS_ADDRESS && runtimeDir && existsSync(`${runtimeDir}/bus`)) {
        env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${runtimeDir}/bus`
    }
    if (!env.DISPLAY && sessionEnv?.DISPLAY) {
        env.DISPLAY = sessionEnv.DISPLAY
    }

    let fallbackResult: ExecSpec | undefined
    const fallbackLine = buildFallbackLine(path, key, custom)
    const runFallback = (): ExecSpec => {
        if (!fallbackResult) {
            fallbackResult = runShellCommand(fallbackLine, env)
        }
        return fallbackResult
    }

    const direct = key === 'CUSTOM' ? null : resolveDirectSpec(path, key, custom)
    if (direct) {
        const started = trySpawnDetached(direct.cmd, [...direct.args], env, () => runFallback())
        if (fallbackResult) {
            return {spec: fallbackResult, env}
        }
        if (started) {
            return {spec: direct, env}
        }
    }

    const spec = runFallback()
    return {spec, env}
}

export function detectEditors(): EditorInfo[] {
    const platform = os.platform()
    const descriptors: { key: EditorKey; label: string; candidates: string[] }[] = [
        {key: 'VS_CODE', label: 'VS Code', candidates: ['code', 'code.cmd', 'code.exe']},
        {
            key: 'CODE_INSIDERS',
            label: 'VS Code Insiders',
            candidates: ['code-insiders', 'code-insiders.cmd', 'code-insiders.exe']
        },
        {key: 'VSCODIUM', label: 'VSCodium', candidates: ['codium', 'codium.cmd']},
        {key: 'CURSOR', label: 'Cursor', candidates: ['cursor', 'cursor.exe']},
        {key: 'WINDSURF', label: 'Windsurf', candidates: ['windsurf', 'windsurf.exe']},
        {key: 'ZED', label: 'Zed', candidates: ['zed', 'zed.exe']},
        {
            key: 'INTELLIJ',
            label: 'IntelliJ IDEA',
            candidates: ['idea', 'idea.sh', 'idea64.exe', 'intellij-idea-community', 'intellij-idea-ultimate'],
        },
        {
            key: 'WEBSTORM',
            label: 'WebStorm',
            candidates: collectWebStormCommandCandidates(),
        },
        {key: 'XCODE', label: 'Xcode', candidates: platform === 'darwin' ? ['xed'] : []},
        {
            key: 'SYSTEM',
            label: platform === 'darwin' ? 'Open (Finder)' : platform === 'win32' ? 'Open (Explorer)' : 'Open (System)',
            candidates: platform === 'darwin' ? ['open'] : platform === 'win32' ? ['explorer.exe', 'explorer'] : ['xdg-open'],
        },
    ]

    return descriptors.map((descriptor) => {
        const bin = descriptor.candidates.map((candidate) => which(candidate)).find((value) => Boolean(value))
        return {
            key: descriptor.key,
            label: descriptor.label,
            installed: Boolean(bin),
            bin: bin || undefined,
        }
    })
}
