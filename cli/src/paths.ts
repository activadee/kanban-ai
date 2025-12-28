import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// XDG Base Directory Specification constants
export const XDG_CONFIG_HOME_ENV = 'XDG_CONFIG_HOME'
export const XDG_CACHE_HOME_ENV = 'XDG_CACHE_HOME'

// Default subdirectory names
export const CONFIG_SUBDIR = 'kanban-ai'
export const CACHE_SUBDIR = 'kanban-ai'

// Legacy directory name for migration detection
export const LEGACY_DIR_NAME = '.kanbanAI'

/**
 * Get the user's config directory following XDG Base Directory Specification
 * @param customHome Optional custom home directory (useful for testing)
 * @returns The config directory path
 */
export function getConfigDir(customHome?: string): string {
    const home = customHome || os.homedir()
    const xdgConfigHome = process.env[XDG_CONFIG_HOME_ENV]

    if (xdgConfigHome) {
        return path.join(xdgConfigHome, CONFIG_SUBDIR)
    }

    return path.join(home, '.config', CONFIG_SUBDIR)
}

/**
 * Get the user's cache directory following XDG Base Directory Specification
 * @param customHome Optional custom home directory (useful for testing)
 * @returns The cache directory path
 */
export function getCacheDir(customHome?: string): string {
    const home = customHome || os.homedir()
    const xdgCacheHome = process.env[XDG_CACHE_HOME_ENV]

    if (xdgCacheHome) {
        return path.join(xdgCacheHome, CACHE_SUBDIR)
    }

    return path.join(home, '.cache', CACHE_SUBDIR)
}

/**
 * Get the legacy .kanbanAI directory path for migration detection
 * @param customHome Optional custom home directory (useful for testing)
 * @returns The legacy directory path
 */
export function getLegacyDir(customHome?: string): string {
    const home = customHome || os.homedir()
    return path.join(home, LEGACY_DIR_NAME)
}

/**
 * Check if the legacy .kanbanAI directory exists
 * @param customHome Optional custom home directory (useful for testing)
 * @returns true if legacy directory exists
 */
export function legacyDirExists(customHome?: string): boolean {
    const legacyPath = getLegacyDir(customHome)
    return fs.existsSync(legacyPath)
}

/**
 * Get the path for a specific subdirectory within the config directory
 * @param subdirName The subdirectory name
 * @returns The full path to the subdirectory
 */
export function getConfigSubdirPath(subdirName: string): string {
    return path.join(getConfigDir(), subdirName)
}

/**
 * Get the path for a specific subdirectory within the cache directory
 * @param subdirName The subdirectory name
 * @returns The full path to the subdirectory
 */
export function getCacheSubdirPath(subdirName: string): string {
    return path.join(getCacheDir(), subdirName)
}

/**
 * Path information structure for logging/debugging
 */
export interface PathInfo {
    configDir: string
    cacheDir: string
    legacyDir: string
    legacyExists: boolean
    xdgConfigHome?: string
    xdgCacheHome?: string
}

/**
 * Get comprehensive path information for debugging purposes
 * @returns PathInfo object with all relevant paths
 */
export function getPathInfo(): PathInfo {
    return {
        configDir: getConfigDir(),
        cacheDir: getCacheDir(),
        legacyDir: getLegacyDir(),
        legacyExists: legacyDirExists(),
        xdgConfigHome: process.env[XDG_CONFIG_HOME_ENV],
        xdgCacheHome: process.env[XDG_CACHE_HOME_ENV],
    }
}
