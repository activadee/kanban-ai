import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {getBinaryPath, getCachedVersionsForPlatform} from './cache'
import {BinaryInfo, PlatformArch} from './platform'

const tmpRoot = path.join(os.tmpdir(), 'kanban-ai-cli-test-cache')

const platformArch: PlatformArch = {
    platform: 'linux',
    arch: 'x64',
}

const binaryInfo: BinaryInfo = {
    assetNameCandidates: ['kanban-ai-linux-x64'],
    cacheSubdirPlatform: 'linux',
    cacheSubdirArch: 'x64',
}

beforeEach(async () => {
    await fs.promises.rm(tmpRoot, {recursive: true, force: true})
    await fs.promises.mkdir(tmpRoot, {recursive: true})
})

afterEach(async () => {
    await fs.promises.rm(tmpRoot, {recursive: true, force: true})
})

describe('cache utilities', () => {
    it('builds the expected binary path', () => {
        const p = getBinaryPath(tmpRoot, '1.2.3', platformArch, binaryInfo)
        expect(p).toBe(path.join(tmpRoot, '1.2.3', 'linux', 'x64', 'kanban-ai-linux-x64'))
    })

    it('finds cached versions for a platform', async () => {
        const v1Path = getBinaryPath(tmpRoot, '0.9.0', platformArch, binaryInfo)
        const v2Path = getBinaryPath(tmpRoot, '1.0.0', platformArch, binaryInfo)
        await fs.promises.mkdir(path.dirname(v1Path), {recursive: true})
        await fs.promises.writeFile(v1Path, '')
        await fs.promises.mkdir(path.dirname(v2Path), {recursive: true})
        await fs.promises.writeFile(v2Path, '')

        const versions = getCachedVersionsForPlatform(tmpRoot, platformArch, binaryInfo)
        expect(versions).toEqual(['1.0.0', '0.9.0'])
    })
})
