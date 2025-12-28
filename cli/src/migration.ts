import fs from 'node:fs'
import path from 'node:path'
import {getConfigDir, getCacheDir, getLegacyDir} from './paths'
import {CONFIG_SUBDIR, CACHE_SUBDIR} from './constants'

export interface MigrationResult {
    success: boolean
    configMigrated: boolean
    cacheMigrated: boolean
    errors: string[]
}

/**
 * Check if migration is needed (legacy directory exists)
 * @returns true if legacy directory exists and new directories don't
 */
export function migrationNeeded(): boolean {
    const legacyExists = fs.existsSync(getLegacyDir())
    // Migration is needed if legacy exists and config doesn't
    const configExists = fs.existsSync(getConfigDir())
    return legacyExists && !configExists
}

/**
 * Get a list of files/directories that need to be migrated from legacy location
 * @returns Object with configItems and cacheItems arrays
 */
export function getMigrationItems(): {configItems: string[], cacheItems: string[]} {
    const legacyDir = getLegacyDir()
    const configItems: string[] = []
    const cacheItems: string[] = []

    try {
        const entries = fs.readdirSync(legacyDir, {withFileTypes: true})

        for (const entry of entries) {
            const fullPath = path.join(legacyDir, entry.name)

            // GitHub API cache should go to config
            if (entry.name === 'github-api' && entry.isDirectory()) {
                configItems.push(entry.name)
            }
            // Everything else (binary, worktrees) goes to cache
            else {
                cacheItems.push(entry.name)
            }
        }
    } catch (error) {
        // Directory doesn't exist or can't be read
        return {configItems: [], cacheItems: []}
    }

    return {configItems, cacheItems}
}

/**
 * Perform the migration from legacy .kanbanAI directory to XDG-compliant locations
 * @param options Options for controlling migration behavior
 * @returns MigrationResult with details about the migration
 */
export async function migrateFromLegacy(options: {
    dryRun?: boolean
    force?: boolean
    onProgress?: (message: string) => void
} = {}): Promise<MigrationResult> {
    const {dryRun = false, force = false, onProgress} = options

    const result: MigrationResult = {
        success: false,
        configMigrated: false,
        cacheMigrated: false,
        errors: [],
    }

    try {
        const legacyDir = getLegacyDir()
        const configDir = getConfigDir()
        const cacheDir = getCacheDir()

        if (!fs.existsSync(legacyDir)) {
            onProgress?.('No legacy directory found. Migration not needed.')
            result.success = true
            return result
        }

        if (fs.existsSync(configDir) && !force) {
            onProgress?.('XDG-compliant directories already exist. Migration not needed.')
            result.success = true
            return result
        }

        onProgress?.(`Starting migration from ${legacyDir}`)

        // Create directories if they don't exist
        if (!dryRun) {
            fs.mkdirSync(configDir, {recursive: true})
            fs.mkdirSync(cacheDir, {recursive: true})
        }

        // Get items to migrate
        const {configItems, cacheItems} = getMigrationItems()

        if (configItems.length > 0) {
            onProgress?.(`Migrating config items: ${configItems.join(', ')}`)

            for (const item of configItems) {
                const source = path.join(legacyDir, item)
                const destination = path.join(configDir, item)

                if (dryRun) {
                    onProgress?.(`[DRY RUN] Would copy ${source} to ${destination}`)
                } else {
                    onProgress?.(`Copying ${source} to ${destination}`)
                    await copyRecursive(source, destination)
                }
            }

            if (!dryRun) {
                result.configMigrated = true
            }
        }

        if (cacheItems.length > 0) {
            onProgress?.(`Migrating cache items: ${cacheItems.join(', ')}`)

            for (const item of cacheItems) {
                const source = path.join(legacyDir, item)
                const destination = path.join(cacheDir, item)

                if (dryRun) {
                    onProgress?.(`[DRY RUN] Would copy ${source} to ${destination}`)
                } else {
                    onProgress?.(`Copying ${source} to ${destination}`)
                    await copyRecursive(source, destination)
                }
            }

            if (!dryRun) {
                result.cacheMigrated = true
            }
        }

        result.success = true
        onProgress?.('Migration completed successfully!')
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push(errorMessage)
        onProgress?.(`Migration failed: ${errorMessage}`)
    }

    return result
}

/**
 * Copy a directory recursively
 */
async function copyRecursive(source: string, destination: string): Promise<void> {
    // Check if source is a directory
    const stats = fs.statSync(source)

    if (stats.isDirectory()) {
        // Create destination directory
        fs.mkdirSync(destination, {recursive: true})

        // Copy all contents
        const entries = fs.readdirSync(source, {withFileTypes: true})

        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name)
            const destPath = path.join(destination, entry.name)

            if (entry.isDirectory()) {
                await copyRecursive(sourcePath, destPath)
            } else {
                fs.copyFileSync(sourcePath, destPath)
            }
        }
    } else {
        // It's a file, just copy it
        fs.copyFileSync(source, destination)
    }
}

/**
 * Get the status of migration without performing it
 * @returns Object describing current migration status
 */
export function getMigrationStatus(): {
    legacyExists: boolean
    configExists: boolean
    cacheExists: boolean
    needsMigration: boolean
    pendingItems: {configItems: string[], cacheItems: string[]}
} {
    const legacyDir = getLegacyDir()
    const configDir = getConfigDir()
    const cacheDir = getCacheDir()

    const legacyExists = fs.existsSync(legacyDir)
    const configExists = fs.existsSync(configDir)
    const cacheExists = fs.existsSync(cacheDir)

    const needsMigration = legacyExists && (!configExists || !cacheExists)

    let pendingItems = {configItems: [] as string[], cacheItems: [] as string[]}
    if (needsMigration) {
        pendingItems = getMigrationItems()
    }

    return {
        legacyExists,
        configExists,
        cacheExists,
        needsMigration,
        pendingItems,
    }
}
