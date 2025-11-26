import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {ensureBinaryDownloaded} from './download'
import {BinaryInfo} from './platform'
import type {GithubRelease} from './github'

const tmpRoot = path.join(os.tmpdir(), 'kanban-ai-cli-download-test')

const binaryInfo: BinaryInfo = {
    assetNameCandidates: ['kanban-ai-linux-x64'],
    cacheSubdirPlatform: 'linux',
    cacheSubdirArch: 'x64',
}

const baseRelease: GithubRelease = {
    tag_name: 'v1.0.0',
    assets: [
        {
            name: 'kanban-ai-linux-x64',
            browser_download_url: 'https://example.com/bin',
        },
    ],
}

const originalFetch = globalThis.fetch

beforeEach(async () => {
    await fs.promises.rm(tmpRoot, {recursive: true, force: true})
    await fs.promises.mkdir(tmpRoot, {recursive: true})
})

afterEach(async () => {
    await fs.promises.rm(tmpRoot, {recursive: true, force: true})
    globalThis.fetch = originalFetch
})

describe('ensureBinaryDownloaded', () => {
    it('returns existing binary path without downloading', async () => {
        const version = '1.0.0'
        const targetDir = path.join(tmpRoot, version, binaryInfo.cacheSubdirPlatform, binaryInfo.cacheSubdirArch)
        const targetPath = path.join(targetDir, binaryInfo.assetNameCandidates[0])

        await fs.promises.mkdir(targetDir, {recursive: true})
        await fs.promises.writeFile(targetPath, 'existing')

        const result = await ensureBinaryDownloaded({
            baseCacheDir: tmpRoot,
            version,
            binaryInfo,
            release: baseRelease,
        })

        expect(result).toBe(targetPath)
    })

    it('downloads binary when not present', async () => {
        const version = '1.0.0'

        // Minimal ReadableStream body.
        const body = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3]))
                controller.close()
            },
        })

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            body,
            text: async () => '',
        } as any)
        globalThis.fetch = fetchMock as any

        const result = await ensureBinaryDownloaded({
            baseCacheDir: tmpRoot,
            version,
            binaryInfo,
            release: baseRelease,
        })

        const stat = await fs.promises.stat(result)
        expect(stat.isFile()).toBe(true)
        expect(stat.size).toBeGreaterThan(0)
    })

    it('throws when matching asset is not found', async () => {
        await expect(
            ensureBinaryDownloaded({
                baseCacheDir: tmpRoot,
                version: '1.0.0',
                binaryInfo: {
                    ...binaryInfo,
                    assetNameCandidates: ['missing-binary'],
                },
                release: {
                    tag_name: 'v1.0.0',
                    assets: [],
                },
            }),
        ).rejects.toThrow(/No matching binary asset/)
    })
})
