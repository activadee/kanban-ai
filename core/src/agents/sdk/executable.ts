import {execFile} from 'node:child_process'
import {promises as fs, constants as fsConstants} from 'node:fs'
import {promisify} from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Options for locating an executable.
 */
export type ExecutableLocatorOptions = {
    /**
     * Environment variable names to check for the executable path.
     * Checked in order, first non-empty value wins.
     */
    envVars?: string[]
    /**
     * Override path from profile configuration.
     * Takes highest priority if provided.
     */
    profileOverride?: string | null
}

/**
 * Verifies that a file exists and is executable.
 * @throws Error if the file is not accessible or not executable.
 */
export async function verifyExecutable(path: string, name: string): Promise<string> {
    const candidate = path.trim()
    if (!candidate.length) {
        throw new Error(`${name} executable path is empty`)
    }
    const mode = process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK
    try {
        await fs.access(candidate, mode)
        return candidate
    } catch (err) {
        throw new Error(`${name} executable not accessible at ${candidate}: ${String(err)}`)
    }
}

/**
 * Locates an executable by name using the system PATH.
 * @returns The full path to the executable, or null if not found.
 */
async function findInPath(name: string): Promise<string | null> {
    const locator = process.platform === 'win32' ? 'where' : 'which'
    try {
        const {stdout} = await execFileAsync(locator, [name])
        const candidate = stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .at(0)
        return candidate ?? null
    } catch {
        return null
    }
}

/**
 * Locates an executable using various strategies:
 * 1. Profile override (if provided)
 * 2. Environment variables (checked in order)
 * 3. System PATH lookup
 *
 * @param name - The name of the executable (e.g., 'codex', 'droid')
 * @param options - Location options
 * @throws Error if the executable cannot be found or is not accessible
 */
export async function locateExecutable(
    name: string,
    options: ExecutableLocatorOptions = {},
): Promise<string> {
    const {envVars = [], profileOverride} = options

    // 1. Profile override takes highest priority
    if (profileOverride) {
        return verifyExecutable(profileOverride, name)
    }

    // 2. Check environment variables in order
    for (const envVar of envVars) {
        const envPath = process.env[envVar]
        if (envPath) {
            return verifyExecutable(envPath, name)
        }
    }

    // 3. Fall back to system PATH
    const pathResult = await findInPath(name)
    if (pathResult) {
        return verifyExecutable(pathResult, name)
    }

    // Build helpful error message
    const envHint = envVars.length > 0 ? ` or set ${envVars.join('/')}` : ''
    throw new Error(
        `${name} executable not found. Install the ${name} CLI and ensure it is on PATH${envHint}.`,
    )
}
