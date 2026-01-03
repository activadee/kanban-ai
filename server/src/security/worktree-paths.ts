import {realpath} from 'fs/promises'
import {resolve, relative, isAbsolute, sep} from 'path'

let worktreesRootReal: string | null = null

export async function initializeSecurityContext(worktreesRoot: string): Promise<void> {
    worktreesRootReal = await realpath(worktreesRoot)
}

export function getWorktreesRootSecure(): string {
    if (!worktreesRootReal) {
        throw new Error('Security context not initialized')
    }
    return worktreesRootReal
}

export function isContainedWithin(targetPath: string, rootPath: string): boolean {
    if (!isAbsolute(targetPath) || !isAbsolute(rootPath)) {
        return false
    }

    const normalizedTarget = resolve(targetPath)
    const normalizedRoot = resolve(rootPath)

    const relativePath = relative(normalizedRoot, normalizedTarget)

    if (relativePath === '') {
        return true
    }

    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        return false
    }

    const components = relativePath.split(sep)
    return !components.some((c) => c === '..' || c === '.')
}

export async function isContainedWithinReal(
    targetPath: string,
    rootPath: string,
): Promise<boolean> {
    try {
        const realTarget = await realpath(targetPath)
        const realRoot = await realpath(rootPath)
        return isContainedWithin(realTarget, realRoot)
    } catch {
        return false
    }
}

export async function validateWorktreePath(requestedPath: string): Promise<string | null> {
    const root = getWorktreesRootSecure()

    if (!requestedPath || typeof requestedPath !== 'string') {
        return null
    }

    const normalized = resolve(requestedPath)

    if (!isContainedWithin(normalized, root)) {
        return null
    }

    try {
        const real = await realpath(normalized)
        if (!isContainedWithin(real, root)) {
            return null
        }
        return real
    } catch {
        return null
    }
}
