import {describe, expect, it} from 'vitest'
import {resolveBinaryInfo} from './platform'

describe('resolveBinaryInfo', () => {
    it('resolves linux x64 binary name and cache subdirs', () => {
        const info = resolveBinaryInfo('linux', 'x64')
        expect(info.assetNameCandidates[0]).toBe('kanban-ai-linux-x64')
        expect(info.cacheSubdirPlatform).toBe('linux')
        expect(info.cacheSubdirArch).toBe('x64')
    })

    it('resolves linux arm64 binary name and cache subdirs', () => {
        const info = resolveBinaryInfo('linux', 'arm64')
        expect(info.assetNameCandidates[0]).toBe('kanban-ai-linux-arm64')
        expect(info.cacheSubdirPlatform).toBe('linux')
        expect(info.cacheSubdirArch).toBe('arm64')
    })

    it('resolves darwin arm64 binary name and cache subdirs', () => {
        const info = resolveBinaryInfo('darwin', 'arm64')
        expect(info.assetNameCandidates[0]).toBe('kanban-ai-darwin-arm64')
        expect(info.cacheSubdirPlatform).toBe('darwin')
        expect(info.cacheSubdirArch).toBe('arm64')
    })

    it('resolves win32 x64 binary name candidates and cache subdirs', () => {
        const info = resolveBinaryInfo('win32', 'x64')
        expect(info.assetNameCandidates).toEqual(['kanban-ai-win-x64.exe', 'kanban-ai-win-x64'])
        expect(info.cacheSubdirPlatform).toBe('win32')
        expect(info.cacheSubdirArch).toBe('x64')
    })
})
