export type SupportedPlatform = 'linux' | 'darwin' | 'win32'
export type SupportedArch = 'x64' | 'arm64'

export interface PlatformArch {
    platform: SupportedPlatform
    arch: SupportedArch
}

export interface BinaryInfo {
    assetNameCandidates: string[]
    cacheSubdirPlatform: string
    cacheSubdirArch: string
}

export function detectPlatformArch(): PlatformArch {
    const platform = process.platform
    const arch = process.arch

    if (!['linux', 'darwin', 'win32'].includes(platform)) {
        throw new Error(`Unsupported platform: ${platform}`)
    }

    if (!['x64', 'arm64'].includes(arch)) {
        throw new Error(`Unsupported architecture: ${arch}`)
    }

    return {
        platform: platform as SupportedPlatform,
        arch: arch as SupportedArch,
    }
}

export function resolveBinaryInfo(platform: SupportedPlatform, arch: SupportedArch): BinaryInfo {
    const baseName = 'kanban-ai'

    if (platform === 'linux' && arch === 'x64') {
        return withCandidates(`${baseName}-linux-x64`)
    }
    if (platform === 'linux' && arch === 'arm64') {
        return withCandidates(`${baseName}-linux-arm64`)
    }
    if (platform === 'darwin' && arch === 'arm64') {
        return withCandidates(`${baseName}-darwin-arm64`)
    }
    if (platform === 'win32' && arch === 'x64') {
        // Support both with and without .exe extension in releases.
        return {
            assetNameCandidates: [`${baseName}-win-x64.exe`, `${baseName}-win-x64`],
            cacheSubdirPlatform: 'win32',
            cacheSubdirArch: 'x64',
        }
    }

    throw new Error(`Unsupported platform/arch combination: ${platform} ${arch}`)
}

function withCandidates(baseName: string): BinaryInfo {
    return {
        assetNameCandidates: [baseName],
        cacheSubdirPlatform: baseName.includes('darwin') ? 'darwin' : 'linux',
        cacheSubdirArch: baseName.endsWith('arm64') ? 'arm64' : 'x64',
    }
}
