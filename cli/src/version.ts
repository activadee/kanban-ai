export interface Semver {
    major: number;
    minor: number;
    patch: number;
    prerelease: (string | number)[];
}

export function cleanVersionTag(tag: string): string {
    return tag.startsWith("v") ? tag.slice(1) : tag;
}

export function parseSemver(version: string): Semver | null {
    const cleaned = cleanVersionTag(version);
    const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
    if (!match) {
        return null;
    }
    const prereleaseRaw = match[4];
    const prerelease: (string | number)[] = [];
    if (prereleaseRaw) {
        for (const id of prereleaseRaw.split(".")) {
            const n = Number(id);
            if (!Number.isNaN(n) && String(n) === id) {
                prerelease.push(n);
            } else {
                prerelease.push(id);
            }
        }
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease,
    };
}

export function compareVersions(a: string, b: string): number {
    const av = parseSemver(a);
    const bv = parseSemver(b);

    if (!av || !bv) {
        return a.localeCompare(b);
    }

    if (av.major !== bv.major) return av.major - bv.major;
    if (av.minor !== bv.minor) return av.minor - bv.minor;
    if (av.patch !== bv.patch) return av.patch - bv.patch;

    const aHasPre = av.prerelease.length > 0;
    const bHasPre = bv.prerelease.length > 0;

    if (!aHasPre && !bHasPre) return 0;
    if (aHasPre && !bHasPre) return -1;
    if (!aHasPre && bHasPre) return 1;

    const len = Math.max(av.prerelease.length, bv.prerelease.length);
    for (let i = 0; i < len; i++) {
        const aId = av.prerelease[i];
        const bId = bv.prerelease[i];
        if (aId === undefined) return -1;
        if (bId === undefined) return 1;
        if (aId === bId) continue;

        const aNum = typeof aId === "number";
        const bNum = typeof bId === "number";

        if (aNum && bNum) {
            return (aId as number) - (bId as number);
        }
        if (aNum && !bNum) return -1;
        if (!aNum && bNum) return 1;

        return String(aId).localeCompare(String(bId));
    }
    return 0;
}

export function sortVersionsDescending(versions: string[]): string[] {
    return [...versions].sort((a, b) => compareVersions(b, a));
}
