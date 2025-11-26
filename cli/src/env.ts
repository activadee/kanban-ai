import os from 'node:os'
import path from 'node:path'
import {
    CACHE_DIR_NAME,
    CACHE_SUBDIR_BINARY,
    DEFAULT_GITHUB_REPO,
    KANBANAI_ASSUME_NO_ENV,
    KANBANAI_ASSUME_YES_ENV,
    KANBANAI_BINARY_VERSION_ENV,
    KANBANAI_GITHUB_REPO_ENV,
    KANBANAI_HOME_ENV,
    KANBANAI_NO_UPDATE_CHECK_ENV,
} from './constants'

export interface EnvOptions {
    githubRepo: string
    baseCacheDir: string
    binaryVersionOverride?: string
    noUpdateCheck: boolean
    assumeYes: boolean
    assumeNo: boolean
}

export function resolveEnvOptions(): EnvOptions {
    const homeEnv = process.env[KANBANAI_HOME_ENV] || process.env.HOME || process.env.USERPROFILE
    const home = homeEnv || os.homedir()

    const baseCacheDir = path.join(home, CACHE_DIR_NAME, CACHE_SUBDIR_BINARY)

    const githubRepo = process.env[KANBANAI_GITHUB_REPO_ENV] || DEFAULT_GITHUB_REPO

    const binaryVersionOverride = process.env[KANBANAI_BINARY_VERSION_ENV] || undefined

    const noUpdateCheck = toBoolEnv(process.env[KANBANAI_NO_UPDATE_CHECK_ENV])
    const assumeYes = toBoolEnv(process.env[KANBANAI_ASSUME_YES_ENV])
    const assumeNo = toBoolEnv(process.env[KANBANAI_ASSUME_NO_ENV])

    return {
        githubRepo,
        baseCacheDir,
        binaryVersionOverride,
        noUpdateCheck,
        assumeYes,
        assumeNo,
    }
}

function toBoolEnv(value: string | undefined): boolean {
    if (!value) return false
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y'
}
