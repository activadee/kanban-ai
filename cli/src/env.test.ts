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

        const env = resolveEnvOptions()

        expect(env.githubRepo).toBe('activadee/kanban-ai')
        expect(env.baseCacheDir.endsWith(path.join('.kanbanAI', 'binary'))).toBe(true)
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

        const env = resolveEnvOptions()

        expect(env.githubRepo).toBe('someone/else')
        expect(env.baseCacheDir).toBe(path.join('/tmp/kanbanai-home', '.kanbanAI', 'binary'))
        expect(env.binaryVersionOverride).toBe('1.2.3')
        expect(env.noUpdateCheck).toBe(true)
        expect(env.assumeYes).toBe(true)
        expect(env.assumeNo).toBe(true)
    })
})
