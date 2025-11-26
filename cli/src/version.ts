export interface Semver {
    major: number
    minor: number
    patch: number
}

export function cleanVersionTag(tag: string): string {
    return tag.startsWith('v') ? tag.slice(1) : tag
}

export function parseSemver(version: string): Semver | null {
    const cleaned = cleanVersionTag(version)
    const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) {
        return null
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    }
}

export function compareVersions(a: string, b: string): number {
    const av = parseSemver(a)
    const bv = parseSemver(b)

    if (!av || !bv) {
        return a.localeCompare(b)
    }

    if (av.major !== bv.major) return av.major - bv.major
    if (av.minor !== bv.minor) return av.minor - bv.minor
    if (av.patch !== bv.patch) return av.patch - bv.patch
    return 0
}

export function sortVersionsDescending(versions: string[]): string[] {
    return [...versions].sort((a, b) => compareVersions(b, a))
}
