import type {SimpleGit} from 'simple-git'
import {settingsService} from '../settings/service'

function trimOrNull(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

async function readGitConfigValue(g: SimpleGit, key: string): Promise<string | null> {
    try {
        const out = await g.raw(['config', '--get', key])
        return trimOrNull(out)
    } catch {
        return null
    }
}

export async function ensureGitAuthorIdentity(g: SimpleGit): Promise<{ name: string; email: string }> {
    const snapshot = settingsService.snapshot()
    const preferredName = trimOrNull(snapshot.gitUserName)
    const preferredEmail = trimOrNull(snapshot.gitUserEmail)

    const name = preferredName ?? (await readGitConfigValue(g, 'user.name'))
    const email = preferredEmail ?? (await readGitConfigValue(g, 'user.email'))

    if (!name || !email) {
        throw new Error(
            'Git defaults missing: set user name and email in App Settings or via git config before committing',
        )
    }

    await g.raw(['config', 'user.name', name])
    await g.raw(['config', 'user.email', email])

    return {name, email}
}

