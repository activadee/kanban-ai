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
})
