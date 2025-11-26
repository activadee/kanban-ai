import fs from 'node:fs'
import path from 'node:path'
import {promisify} from 'node:util'
import {pipeline} from 'node:stream'
import {Readable} from 'node:stream'
import {BinaryInfo} from './platform'
import type {GithubRelease} from './github'

const streamPipeline = promisify(pipeline)

export async function ensureBinaryDownloaded(options: {
    baseCacheDir: string
    version: string
    binaryInfo: BinaryInfo
    release: GithubRelease
}): Promise<string> {
    const {baseCacheDir, version, binaryInfo, release} = options
    const binaryFileName = binaryInfo.assetNameCandidates[0]

    const targetDir = path.join(baseCacheDir, version, binaryInfo.cacheSubdirPlatform, binaryInfo.cacheSubdirArch)
    const targetPath = path.join(targetDir, binaryFileName)

    if (await fileExists(targetPath)) {
        return targetPath
    }

    const asset = selectAsset(release, binaryInfo)
    if (!asset) {
        const available = release.assets.map((a) => a.name).join(', ')
        throw new Error(
            `No matching binary asset found in release ${release.tag_name}. Expected one of: ${binaryInfo.assetNameCandidates.join(
                ', ',
            )}. Available assets: ${available || '(none)'}`,
        )
    }

    await fs.promises.mkdir(targetDir, {recursive: true})

    const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`
    await downloadToFile(asset.browser_download_url, tmpPath)

    // Make executable on POSIX platforms.
    if (process.platform !== 'win32') {
        await fs.promises.chmod(tmpPath, 0o755)
    }

    await fs.promises.rename(tmpPath, targetPath)

    return targetPath
}

function selectAsset(release: GithubRelease, binaryInfo: BinaryInfo) {
    for (const candidate of binaryInfo.assetNameCandidates) {
        const match = release.assets.find((asset) => asset.name === candidate)
        if (match) return match
    }
    return null
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
    const res = await fetch(url, {
        redirect: 'follow',
    })

    if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '')
        throw new Error(`Failed to download binary: ${res.status} ${res.statusText}${body ? ` - ${body}` : ''}`)
    }

    const fileStream = fs.createWriteStream(destPath)
    const nodeStream = Readable.fromWeb(res.body as any)

    try {
        await streamPipeline(nodeStream, fileStream)
    } catch (err) {
        fileStream.close()
        await fs.promises.unlink(destPath).catch(() => {})
        throw err
    }
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK)
        return true
    } catch {
        return false
    }
}
