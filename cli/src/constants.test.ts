import {describe, expect, it} from 'vitest'
import {
    CACHE_DIR_NAME,
    CACHE_SUBDIR_BINARY,
    CONFIG_SUBDIR,
    CACHE_SUBDIR,
    DEFAULT_GITHUB_REPO,
    KANBANAI_ASSUME_NO_ENV,
    KANBANAI_ASSUME_YES_ENV,
    KANBANAI_BINARY_VERSION_ENV,
    KANBANAI_GITHUB_REPO_ENV,
    KANBANAI_HOME_ENV,
    KANBANAI_NO_UPDATE_CHECK_ENV,
    XDG_CACHE_HOME_ENV,
    XDG_CONFIG_HOME_ENV,
} from './constants'

describe('constants', () => {
    it('exposes expected constant values', () => {
        expect(DEFAULT_GITHUB_REPO).toBe('activadee/kanban-ai')
        expect(KANBANAI_HOME_ENV).toBe('KANBANAI_HOME')
        expect(KANBANAI_BINARY_VERSION_ENV).toBe('KANBANAI_BINARY_VERSION')
        expect(KANBANAI_GITHUB_REPO_ENV).toBe('KANBANAI_GITHUB_REPO')
        expect(KANBANAI_NO_UPDATE_CHECK_ENV).toBe('KANBANAI_NO_UPDATE_CHECK')
        expect(KANBANAI_ASSUME_YES_ENV).toBe('KANBANAI_ASSUME_YES')
        expect(KANBANAI_ASSUME_NO_ENV).toBe('KANBANAI_ASSUME_NO')
        expect(CACHE_DIR_NAME).toBe('.kanbanAI')
        expect(CACHE_SUBDIR_BINARY).toBe('binary')
        expect(XDG_CONFIG_HOME_ENV).toBe('XDG_CONFIG_HOME')
        expect(XDG_CACHE_HOME_ENV).toBe('XDG_CACHE_HOME')
        expect(CONFIG_SUBDIR).toBe('kanban-ai')
        expect(CACHE_SUBDIR).toBe('kanban-ai')
    })
})
