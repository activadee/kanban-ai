import {describe, expect, test, beforeEach, afterEach, vi} from 'vitest'
import os from 'node:os'
import path from 'node:path'
import {
    getConfigDir,
    getCacheDir,
    getLegacyDir,
    legacyDirExists,
    getConfigSubdirPath,
    getCacheSubdirPath,
    getPathInfo,
} from './paths'

describe('Path Resolution', () => {
    const testHome = '/test/home'

    describe('getConfigDir', () => {
        test('uses XDG_CONFIG_HOME when set', () => {
            vi.stubEnv('XDG_CONFIG_HOME', '/custom/config')
            expect(getConfigDir(testHome)).toBe('/custom/config/kanban-ai')
            vi.unstubAllEnvs()
        })

        test('falls back to ~/.config when XDG_CONFIG_HOME not set', () => {
            vi.stubEnv('XDG_CONFIG_HOME', undefined)
            expect(getConfigDir(testHome)).toBe('/test/home/.config/kanban-ai')
            vi.unstubAllEnvs()
        })

        test('uses provided home directory', () => {
            vi.stubEnv('XDG_CONFIG_HOME', undefined)
            expect(getConfigDir('/another/home')).toBe('/another/home/.config/kanban-ai')
            vi.unstubAllEnvs()
        })
    })

    describe('getCacheDir', () => {
        test('uses XDG_CACHE_HOME when set', () => {
            vi.stubEnv('XDG_CACHE_HOME', '/custom/cache')
            expect(getCacheDir(testHome)).toBe('/custom/cache/kanban-ai')
            vi.unstubAllEnvs()
        })

        test('falls back to ~/.cache when XDG_CACHE_HOME not set', () => {
            vi.stubEnv('XDG_CACHE_HOME', undefined)
            expect(getCacheDir(testHome)).toBe('/test/home/.cache/kanban-ai')
            vi.unstubAllEnvs()
        })

        test('uses provided home directory', () => {
            vi.stubEnv('XDG_CACHE_HOME', undefined)
            expect(getCacheDir('/another/home')).toBe('/another/home/.cache/kanban-ai')
            vi.unstubAllEnvs()
        })
    })

    describe('getLegacyDir', () => {
        test('returns ~/.kanbanAI', () => {
            expect(getLegacyDir(testHome)).toBe('/test/home/.kanbanAI')
        })
    })

    describe('legacyDirExists', () => {
        test('returns false when legacy directory does not exist', () => {
            vi.stubEnv('HOME', '/nonexistent')
            expect(legacyDirExists()).toBe(false)
            vi.unstubAllEnvs()
        })
    })

    describe('getConfigSubdirPath', () => {
        test('creates path for config subdirectory', () => {
            vi.stubEnv('XDG_CONFIG_HOME', undefined)
            expect(getConfigSubdirPath('test')).toBe(path.join(os.homedir(), '.config', 'kanban-ai', 'test'))
            vi.unstubAllEnvs()
        })
    })

    describe('getCacheSubdirPath', () => {
        test('creates path for cache subdirectory', () => {
            vi.stubEnv('XDG_CACHE_HOME', undefined)
            expect(getCacheSubdirPath('test')).toBe(path.join(os.homedir(), '.cache', 'kanban-ai', 'test'))
            vi.unstubAllEnvs()
        })
    })

    describe('getPathInfo', () => {
        test('returns comprehensive path information', () => {
            vi.stubEnv('XDG_CONFIG_HOME', undefined)
            vi.stubEnv('XDG_CACHE_HOME', undefined)

            const info = getPathInfo()

            expect(info).toHaveProperty('configDir')
            expect(info).toHaveProperty('cacheDir')
            expect(info).toHaveProperty('legacyDir')
            expect(info).toHaveProperty('legacyExists')
            expect(info).toHaveProperty('xdgConfigHome')
            expect(info).toHaveProperty('xdgCacheHome')
            expect(info).toHaveProperty('platform')

            vi.unstubAllEnvs()
        })

        test('includes XDG environment variables when set', () => {
            vi.stubEnv('XDG_CONFIG_HOME', '/custom/config')
            vi.stubEnv('XDG_CACHE_HOME', '/custom/cache')

            const info = getPathInfo()

            expect(info.xdgConfigHome).toBe('/custom/config')
            expect(info.xdgCacheHome).toBe('/custom/cache')

            vi.unstubAllEnvs()
        })
    })

    describe('Windows Support', () => {
        test('uses APPDATA for config on Windows when XDG not set', () => {
            vi.stubEnv('XDG_CONFIG_HOME', undefined)
            vi.stubEnv('APPDATA', 'C:\\Users\\test\\AppData\\Roaming')

            // Mock platform detection
            const originalPlatform = process.platform
            Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

            const result = getConfigDir('C:\\Users\\test')
            // On Linux, path.join normalizes to forward slashes, but the path structure is correct
            expect(result.toLowerCase()).toContain('appdata\\roaming'.toLowerCase())
            expect(result).toContain('kanban-ai')

            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
            vi.unstubAllEnvs()
        })

        test('uses LOCALAPPDATA for cache on Windows when XDG not set', () => {
            vi.stubEnv('XDG_CACHE_HOME', undefined)
            vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\test\\AppData\\Local')

            // Mock platform detection
            const originalPlatform = process.platform
            Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

            const result = getCacheDir('C:\\Users\\test')
            expect(result.toLowerCase()).toContain('appdata\\local'.toLowerCase())
            expect(result).toContain('kanban-ai')

            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
            vi.unstubAllEnvs()
        })

        test('falls back to AppData\\Roaming when APPDATA not set on Windows', () => {
            vi.stubEnv('XDG_CONFIG_HOME', undefined)
            vi.stubEnv('APPDATA', undefined)

            // Mock platform detection
            const originalPlatform = process.platform
            Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

            const result = getConfigDir('C:\\Users\\test')
            // On Linux, path.join normalizes to forward slashes, so check for both with/without separator
            const normalizedResult = result.toLowerCase().replace(/\\/g, '/')
            expect(normalizedResult).toContain('appdata/roaming')
            expect(result).toContain('kanban-ai')

            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
            vi.unstubAllEnvs()
        })

        test('falls back to AppData\\Local when LOCALAPPDATA not set on Windows', () => {
            vi.stubEnv('XDG_CACHE_HOME', undefined)
            vi.stubEnv('LOCALAPPDATA', undefined)

            // Mock platform detection
            const originalPlatform = process.platform
            Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

            const result = getCacheDir('C:\\Users\\test')
            // On Linux, path.join normalizes to forward slashes, so check for both with/without separator
            const normalizedResult = result.toLowerCase().replace(/\\/g, '/')
            expect(normalizedResult).toContain('appdata/local')
            expect(result).toContain('kanban-ai')

            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
            vi.unstubAllEnvs()
        })
    })
})
