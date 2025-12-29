import path from 'node:path'
import {beforeEach, describe, expect, it} from 'vitest'
import {resolveEnvOptions} from './env'

const originalEnv = {...process.env}

beforeEach(() => {
    process.env = {...originalEnv}
})

describe('resolveEnvOptions', () => {
    it('uses defaults when env vars are not set', () => {
        delete process.env.KANBANAI_HOME
        delete process.env.HOME
        delete process.env.USERPROFILE
        delete process.env.KANBANAI_GITHUB_REPO
        delete process.env.KANBANAI_BINARY_VERSION
        delete process.env.KANBANAI_NO_UPDATE_CHECK
        delete process.env.KANBANAI_ASSUME_YES
        delete process.env.KANBANAI_ASSUME_NO
        delete process.env.XDG_CONFIG_HOME
        delete process.env.XDG_CACHE_HOME

        const env = resolveEnvOptions()

        expect(env.githubRepo).toBe('activadee/kanban-ai')
        expect(env.baseCacheDir.endsWith(path.join('.cache', 'kanban-ai', 'binary'))).toBe(true)
        expect(env.configDir.endsWith(path.join('.config', 'kanban-ai'))).toBe(true)
        expect(env.binaryVersionOverride).toBeUndefined()
        expect(env.noUpdateCheck).toBe(false)
        expect(env.assumeYes).toBe(false)
        expect(env.assumeNo).toBe(false)
    })

    it('reads values from environment variables', () => {
        process.env.KANBANAI_HOME = '/tmp/kanbanai-home'
        process.env.KANBANAI_GITHUB_REPO = 'someone/else'
        process.env.KANBANAI_BINARY_VERSION = '1.2.3'
        process.env.KANBANAI_NO_UPDATE_CHECK = 'true'
        process.env.KANBANAI_ASSUME_YES = '1'
        process.env.KANBANAI_ASSUME_NO = 'yes'
        process.env.XDG_CONFIG_HOME = '/custom/config'
        process.env.XDG_CACHE_HOME = '/custom/cache'

        const env = resolveEnvOptions()

        expect(env.githubRepo).toBe('someone/else')
        expect(env.baseCacheDir).toBe('/custom/cache/kanban-ai/binary')
        expect(env.configDir).toBe('/custom/config/kanban-ai')
        expect(env.binaryVersionOverride).toBe('1.2.3')
        expect(env.noUpdateCheck).toBe(true)
        expect(env.assumeYes).toBe(true)
        expect(env.assumeNo).toBe(true)
    })

    it('uses KANBANAI_HOME for home directory when set', () => {
        process.env.KANBANAI_HOME = '/custom/home'
        delete process.env.XDG_CONFIG_HOME
        delete process.env.XDG_CACHE_HOME

        const env = resolveEnvOptions()

        expect(env.baseCacheDir).toBe('/custom/home/.cache/kanban-ai/binary')
        expect(env.configDir).toBe('/custom/home/.config/kanban-ai')
    })

    it('respects XDG environment variables', () => {
        delete process.env.KANBANAI_HOME
        process.env.XDG_CONFIG_HOME = '/xdg/config'
        process.env.XDG_CACHE_HOME = '/xdg/cache'

        const env = resolveEnvOptions()

        expect(env.configDir).toBe('/xdg/config/kanban-ai')
        expect(env.baseCacheDir).toBe('/xdg/cache/kanban-ai/binary')
    })
})
