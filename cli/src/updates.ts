import readline from 'node:readline'
import {BinaryInfo, PlatformArch} from './platform'
import {EnvOptions} from './env'
import {getCachedVersionsForPlatform} from './cache'
import {compareVersions} from './version'

export interface UpdateDecision {
    versionToUse: string
    fromCache: boolean
}

export async function decideVersionToUse(options: {
    env: EnvOptions
    platformArch: PlatformArch
    binaryInfo: BinaryInfo
    latestRemoteVersion: string
    explicitVersion?: string
    onNewVersionAvailable?: (info: {
        latestRemoteVersion: string
        latestCachedVersion: string
    }) => void | Promise<void>
}): Promise<UpdateDecision> {
    const {env, platformArch, binaryInfo, latestRemoteVersion, explicitVersion, onNewVersionAvailable} = options

    // Explicit version always wins: no update prompting, just use that version.
    if (explicitVersion) {
        return {versionToUse: explicitVersion, fromCache: false}
    }

    const cachedVersions = getCachedVersionsForPlatform(env.baseCacheDir, platformArch, binaryInfo)
    const latestCached = cachedVersions[0]

    if (!latestCached) {
        // No cached versions: just use remote latest.
        return {versionToUse: latestRemoteVersion, fromCache: false}
    }

    const cmp = compareVersions(latestRemoteVersion, latestCached)

    if (cmp <= 0) {
        // Cached version is up-to-date or newer (in case of pre-releases).
        return {versionToUse: latestCached, fromCache: true}
    }

    if (onNewVersionAvailable) {
        await onNewVersionAvailable({
            latestRemoteVersion,
            latestCachedVersion: latestCached,
        })
    }

    // Remote is newer than cache.
    if (env.noUpdateCheck || env.assumeNo) {
        return {versionToUse: latestCached, fromCache: true}
    }

    if (env.assumeYes || !isInteractive()) {
        return {versionToUse: latestRemoteVersion, fromCache: false}
    }

    const answer = await promptYesNo(
        `A new KanbanAI version is available (${latestRemoteVersion}, you have ${latestCached}). Download it now? [Y/n] `,
    )

    if (answer) {
        return {versionToUse: latestRemoteVersion, fromCache: false}
    }

    return {versionToUse: latestCached, fromCache: true}
}

function isInteractive(): boolean {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

async function promptYesNo(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close()
            const normalized = answer.trim().toLowerCase()
            if (!normalized) {
                resolve(true)
            } else if (normalized === 'y' || normalized === 'yes') {
                resolve(true)
            } else if (normalized === 'n' || normalized === 'no') {
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}
