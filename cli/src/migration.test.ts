import {describe, expect, test, beforeEach, afterEach, vi} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    migrationNeeded,
    getMigrationItems,
    migrateFromLegacy,
    getMigrationStatus,
} from './migration'

describe('Migration', () => {
    const testHome = '/tmp/kanban-ai-test'
    const legacyDir = path.join(testHome, '.kanbanAI')
    const configDir = path.join(testHome, '.config', 'kanban-ai')
    const cacheDir = path.join(testHome, '.cache', 'kanban-ai')

    beforeEach(() => {
        // Create test directory structure
        fs.mkdirSync(legacyDir, {recursive: true})
        fs.mkdirSync(path.join(legacyDir, 'binary'), {recursive: true})
        fs.mkdirSync(path.join(legacyDir, 'github-api'), {recursive: true})
        fs.writeFileSync(path.join(legacyDir, 'binary', 'test'), 'test binary')
        fs.writeFileSync(path.join(legacyDir, 'github-api', 'test'), 'test cache')
    })

    afterEach(() => {
        // Cleanup test directories
        fs.rmSync(testHome, {recursive: true, force: true})
        vi.unstubAllEnvs()
    })

    describe('migrationNeeded', () => {
        test('returns true when legacy exists but config does not', () => {
            vi.stubEnv('HOME', testHome)
            expect(migrationNeeded()).toBe(true)
        })

        test('returns false when both legacy and config exist', () => {
            fs.mkdirSync(configDir, {recursive: true})
            vi.stubEnv('HOME', testHome)
            expect(migrationNeeded()).toBe(false)
        })

        test('returns false when legacy does not exist', () => {
            fs.rmSync(legacyDir, {recursive: true, force: true})
            vi.stubEnv('HOME', testHome)
            expect(migrationNeeded()).toBe(false)
        })
    })

    describe('getMigrationItems', () => {
        test('identifies github-api as config item', () => {
            vi.stubEnv('HOME', testHome)
            const {configItems} = getMigrationItems()
            expect(configItems).toContain('github-api')
        })

        test('identifies binary as cache item', () => {
            vi.stubEnv('HOME', testHome)
            const {cacheItems} = getMigrationItems()
            expect(cacheItems).toContain('binary')
        })
    })

    describe('migrateFromLegacy', () => {
        test('performs dry run without creating directories', async () => {
            vi.stubEnv('HOME', testHome)

            const progress: string[] = []
            const result = await migrateFromLegacy({
                dryRun: true,
                onProgress: (msg) => progress.push(msg),
            })

            expect(result.success).toBe(true)
            expect(result.configMigrated).toBe(false)
            expect(result.cacheMigrated).toBe(false)
            expect(progress.some(msg => msg.includes('[DRY RUN]'))).toBe(true)
        })

        test('creates XDG directories when migrating', async () => {
            vi.stubEnv('HOME', testHome)

            const result = await migrateFromLegacy({force: true})

            expect(result.success).toBe(true)
            expect(fs.existsSync(configDir)).toBe(true)
            expect(fs.existsSync(cacheDir)).toBe(true)
        })

        test('copies github-api to config directory', async () => {
            vi.stubEnv('HOME', testHome)

            await migrateFromLegacy({force: true})

            const githubApiPath = path.join(configDir, 'github-api', 'test')
            expect(fs.existsSync(githubApiPath)).toBe(true)
        })

        test('copies binary to cache directory', async () => {
            vi.stubEnv('HOME', testHome)

            await migrateFromLegacy({force: true})

            const binaryPath = path.join(cacheDir, 'binary', 'test')
            expect(fs.existsSync(binaryPath)).toBe(true)
        })
    })

    describe('getMigrationStatus', () => {
        test('returns comprehensive status', () => {
            vi.stubEnv('HOME', testHome)
            const status = getMigrationStatus()

            expect(status).toHaveProperty('legacyExists')
            expect(status).toHaveProperty('configExists')
            expect(status).toHaveProperty('cacheExists')
            expect(status).toHaveProperty('needsMigration')
            expect(status).toHaveProperty('pendingItems')
        })

        test('indicates migration is needed', () => {
            vi.stubEnv('HOME', testHome)
            const status = getMigrationStatus()

            expect(status.legacyExists).toBe(true)
            expect(status.configExists).toBe(false)
            expect(status.needsMigration).toBe(true)
        })
    })
})
