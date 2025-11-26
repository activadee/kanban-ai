import fs from 'node:fs'
import path from 'node:path'
import {BinaryInfo, PlatformArch} from './platform'
import {sortVersionsDescending} from './version'

export function getBinaryPath(baseCacheDir: string, version: string, platformArch: PlatformArch, binaryInfo: BinaryInfo): string {
    const {cacheSubdirPlatform, cacheSubdirArch} = binaryInfo
    const binaryFileName = binaryInfo.assetNameCandidates[0]

    return path.join(baseCacheDir, version, cacheSubdirPlatform, cacheSubdirArch, binaryFileName)
}

export function getCachedVersionsForPlatform(baseCacheDir: string, platformArch: PlatformArch, binaryInfo: BinaryInfo): string[] {
    if (!fs.existsSync(baseCacheDir)) {
        return []
    }

    const {cacheSubdirPlatform, cacheSubdirArch} = binaryInfo

    const versions: string[] = []

    for (const entry of fs.readdirSync(baseCacheDir, {withFileTypes: true})) {
        if (!entry.isDirectory()) continue
        const versionDir = path.join(baseCacheDir, entry.name, cacheSubdirPlatform, cacheSubdirArch)
        const binaryFileName = binaryInfo.assetNameCandidates[0]
        const candidate = path.join(versionDir, binaryFileName)
        if (fs.existsSync(candidate)) {
            versions.push(entry.name)
        }
    }

    return sortVersionsDescending(versions)
}
