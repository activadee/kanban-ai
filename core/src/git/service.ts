import simpleGit, {type SimpleGit} from 'simple-git'
import type {FileChange, GitStatus} from 'shared'
import {promises as fsp} from 'fs'
import {resolve} from 'path'
import {getRepositoryPath} from '../projects/repo'
import type {AppEventBus} from '../events/bus'
import {settingsService} from '../settings/service'

let gitEvents: AppEventBus | null = null

type GitEventMeta = {
    projectId?: string
    attemptId?: string
}

export function bindGitEventBus(bus: AppEventBus) {
    gitEvents = bus
}

function publishStatusChanged(meta?: GitEventMeta) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.status.changed', {projectId: meta.projectId})
}

function publishCommitCreated(meta: GitEventMeta | undefined, shortSha: string, subject: string, ts: string) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.commit.created', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        shortSha,
        subject,
        ts,
    })
}

function publishPushCompleted(meta: GitEventMeta | undefined, remote: string, branch: string, ts: string) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.push.completed', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        remote,
        branch,
        ts,
    })
}

function publishMergeCompleted(meta: GitEventMeta | undefined, merged: boolean, message: string) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.merge.completed', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        result: {merged, message},
    })
}

export async function getRepoPath(projectId: string): Promise<string> {
    const path = await getRepositoryPath(projectId)
    if (!path) throw new Error('Project not found')
    return path
}

function git(repoPath: string): SimpleGit {
    return simpleGit({baseDir: repoPath})
}

function trimOrNull(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

function normalizeSha(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return /^[0-9a-f]{7,40}$/i.test(trimmed) ? trimmed : null
}

function extractShaFromCommitResult(result: Awaited<ReturnType<SimpleGit['commit']>>): string | null {

    if (result && typeof result === 'object' && 'commit' in result) {
        const commitValue = (result as any).commit
        if (typeof commitValue === 'string') {
            const normalized = normalizeSha(commitValue)
            if (normalized) return normalized
        }
    }
    return null
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
        throw new Error('Git defaults missing: set user name and email in App Settings or via git config before committing')
    }

    await g.raw(['config', 'user.name', name])
    await g.raw(['config', 'user.email', email])

    return {name, email}
}

function mapFileChanges(status: Awaited<ReturnType<SimpleGit['status']>>): FileChange[] {
    const result: FileChange[] = []
    for (const f of status.files) {
        const stagedFlag = f.index.trim()
        const worktreeFlag = f.working_dir.trim()
        const letter = (stagedFlag || worktreeFlag || 'M') as FileChange['status']
        const change: FileChange = {
            path: f.path,
            status: (letter as any) ?? 'M',
            staged: Boolean(stagedFlag && stagedFlag !== ' '),
        }
        if (f.from && f.from !== f.path) change.oldPath = f.from
        result.push(change)
    }
    return result
}

export async function getStatus(projectId: string): Promise<GitStatus> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    const st = await g.status()

    let ahead = 0
    let behind = 0
    try {
        const hasUpstream = st.tracking && st.tracking.length > 0
        if (hasUpstream) {
            const out = await g.raw(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
            const [behindStr, aheadStr] = out.trim().split(/\s+/)
            behind = Number(behindStr || 0)
            ahead = Number(aheadStr || 0)
        }
    } catch {
    }

    const files = mapFileChanges(st)
    const summary = {
        added: st.created.length,
        modified: st.modified.length,
        deleted: st.deleted.length,
        untracked: st.not_added.length,
        staged: files.filter((f) => f.staged).length,
    }

    const hasUncommitted =
        summary.added + summary.modified + summary.deleted + summary.untracked > 0

    return {
        branch: st.current || 'HEAD',
        ahead,
        behind,
        hasUncommitted,
        files,
        summary,
    }
}

export async function getDiff(projectId: string, path?: string, staged?: boolean): Promise<string> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    const args: string[] = []
    if (staged) args.push('--cached')
    if (path) args.push('--', path)
    const diff = await g.diff(args)
    return diff
}

export async function stageFiles(projectId: string, paths: string[]): Promise<void> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    if (!paths?.length) return
    await g.add(paths)
}

export async function unstageFiles(projectId: string, paths: string[]): Promise<void> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    if (!paths?.length) return
    await g.raw(['reset', '-q', 'HEAD', '--', ...paths])
}

async function commitWithHash(g: SimpleGit, message: string): Promise<string> {
    // Always stage everything (including deletions) before committing
    await g.add(['-A'])

    const previousHead = await g.revparse(['HEAD']).catch(() => null)
    const result = await g.commit(message)
    const shaFromResult = extractShaFromCommitResult(result)
    const currentHead = await g.revparse(['HEAD']).catch(() => null)

    if (shaFromResult) return shaFromResult
    if (currentHead && currentHead !== previousHead) return currentHead.trim()

    const summary = (result && typeof result === 'object' && 'summary' in result) ? (result as any).summary ?? {} : {}
    const {changes = 0, insertions = 0, deletions = 0} = summary as {
        changes?: number; insertions?: number; deletions?: number
    }

    const rawOutput = typeof result === 'string' ? result : ''
    const nothingToCommit = rawOutput.toLowerCase().includes('nothing to commit')

    if (!changes && !insertions && !deletions) {
        throw new Error(nothingToCommit ? 'No staged changes to commit.' : 'Git commit failed: no commit hash returned.')
    }

    if (currentHead) return currentHead.trim()
    throw new Error('Git commit succeeded but commit hash could not be determined.')
}

export async function commit(projectId: string, subject: string, body?: string): Promise<string> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    if (!subject?.trim()) throw new Error('Commit subject is required')
    const message = body?.trim() ? `${subject.trim()}\n\n${body.trim()}` : subject.trim()
    await ensureGitAuthorIdentity(g)
    return commitWithHash(g, message)
}

export async function push(
    projectId: string,
    {remote, branch, token, setUpstream}: { remote?: string; branch?: string; token?: string; setUpstream?: boolean },
): Promise<void> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    const st = await g.status()
    const targetBranch = branch?.trim() || st.current || 'HEAD'
    const targetRemote = remote?.trim() || st.tracking?.split('/')?.[0] || 'origin'

    if (token) {
        const args = ['-c', `http.extraHeader=Authorization: Bearer ${token}`, 'push']
        if (setUpstream) args.push('-u')
        args.push(targetRemote, targetBranch)
        await g.raw(args)
    } else {
        const args: string[] = []
        if (setUpstream) args.push('-u')
        await g.push(targetRemote, targetBranch, args)
    }
}

export type FileSource = 'worktree' | 'index' | 'head' | 'base'

export async function getFileContent(
    projectId: string,
    path: string,
    source: FileSource,
    baseBranch?: string,
): Promise<string | null> {
    const repoPath = await getRepoPath(projectId)
    const g = git(repoPath)
    try {
        if (source === 'worktree') {
            const full = resolve(repoPath, path)
            const buf = await fsp.readFile(full)
            return buf.toString('utf8')
        }
        if (source === 'index') {
            const out = await g.raw(['show', `:${path}`])
            return out
        }
        if (source === 'head') {
            const out = await g.raw(['show', `HEAD:${path}`])
            return out
        }
        if (source === 'base') {
            const base = baseBranch?.trim() || 'origin/main'
            const out = await g.raw(['show', `${base}:${path}`]).catch(() => '')
            return out || null
        }
        return null
    } catch {
        return null
    }
}

// --- Path-scoped helpers used by worktree consumers (e.g., attempts) ---

function gitAtPath(worktreePath: string): SimpleGit {
    return simpleGit({baseDir: worktreePath})
}

export async function resolveBaseRefAtPath(worktreePath: string, baseBranch?: string, remote?: string): Promise<string> {
    const g = gitAtPath(worktreePath)
    const status = await g.status()
    const remoteName = remote?.trim() || status.tracking?.split('/')?.[0] || 'origin'
    const branchName = baseBranch?.trim() || 'main'
    return `${remoteName}/${branchName}`
}

export async function resolveBaseAncestorAtPath(worktreePath: string, baseBranch?: string, remote?: string): Promise<string> {
    const baseRef = await resolveBaseRefAtPath(worktreePath, baseBranch, remote)
    const g = gitAtPath(worktreePath)
    const out = await g.raw(['merge-base', 'HEAD', baseRef])
    return out.trim()
}

export async function getStatusAgainstBaseAtPath(worktreePath: string, baseAncestorRef?: string): Promise<GitStatus> {
    const g = gitAtPath(worktreePath)
    const status = await g.status()

    let ahead = 0
    let behind = 0
    try {
        const ref = baseAncestorRef?.trim() || 'HEAD'
        const out = await g.raw(['rev-list', '--left-right', '--count', `${ref}...HEAD`])
        const [behindStr, aheadStr] = out.trim().split(/\s+/)
        behind = Number(behindStr || 0)
        ahead = Number(aheadStr || 0)
    } catch {
    }

    const files = mapFileChanges(status)
    const summary = {
        added: status.created.length,
        modified: status.modified.length,
        deleted: status.deleted.length,
        untracked: status.not_added.length,
        staged: files.filter((f) => f.staged).length,
    }

    const hasUncommitted = summary.added + summary.modified + summary.deleted + summary.untracked > 0

    return {
        branch: status.current || 'HEAD',
        ahead,
        behind,
        hasUncommitted,
        files,
        summary,
    }
}

export async function getFileContentAtPath(
    worktreePath: string,
    path: string,
    source: FileSource,
    baseRef?: string,
): Promise<string | null> {
    const g = gitAtPath(worktreePath)
    try {
        if (source === 'worktree') {
            const full = resolve(worktreePath, path)
            const buf = await fsp.readFile(full)
            return buf.toString('utf8')
        }
        if (source === 'index') return await g.raw(['show', `:${path}`])
        if (source === 'head') return await g.raw(['show', `HEAD:${path}`])
        if (source === 'base') {
            const ref = baseRef?.trim() || (await resolveBaseRefAtPath(worktreePath))
            const out = await g.raw(['show', `${ref}:${path}`]).catch(() => '')
            return out || null
        }
        return null
    } catch {
        return null
    }
}

export async function stageAtPath(worktreePath: string, paths?: string[], meta?: GitEventMeta) {
    const g = gitAtPath(worktreePath)
    await g.add(paths && paths.length ? paths : ['.'])
    publishStatusChanged(meta)
}

export async function unstageAtPath(worktreePath: string, paths?: string[], meta?: GitEventMeta) {
    const g = gitAtPath(worktreePath)
    await g.raw(['reset', '-q', 'HEAD', '--', ...(paths && paths.length ? paths : ['.'])])
    publishStatusChanged(meta)
}

export async function commitAtPath(
    worktreePath: string,
    subject: string,
    body?: string,
    meta?: GitEventMeta,
): Promise<string> {
    const g = gitAtPath(worktreePath)
    const message = body?.trim() ? `${subject.trim()}\n\n${body.trim()}` : subject.trim()
    await ensureGitAuthorIdentity(g)
    const sha = await commitWithHash(g, message)
    const ts = new Date().toISOString()
    publishCommitCreated(meta, sha, subject.trim(), ts)
    publishStatusChanged(meta)
    return sha
}

export async function pushAtPath(
    worktreePath: string,
    {remote, branch, token, setUpstream}: { remote?: string; branch?: string; token?: string; setUpstream?: boolean },
    meta?: GitEventMeta,
) {
    const g = gitAtPath(worktreePath)
    const status = await g.status()
    const targetBranch = branch?.trim() || status.current || 'HEAD'
    const targetRemote = remote?.trim() || status.tracking?.split('/')?.[0] || 'origin'

    if (token) {
        const args = ['-c', `http.extraHeader=Authorization: Bearer ${token}`, 'push']
        if (setUpstream) args.push('-u')
        args.push(targetRemote, targetBranch)
        await g.raw(args)
    } else {
        const args: string[] = []
        if (setUpstream) args.push('-u')
        await g.push(targetRemote, targetBranch, args)
    }

    const ts = new Date().toISOString()
    publishPushCompleted(meta, targetRemote, targetBranch, ts)
    publishStatusChanged(meta)
}

export async function mergeBranchIntoBaseForProject(
    projectId: string,
    {remote, baseBranch, headBranch}: { remote?: string | null; baseBranch?: string | null; headBranch: string },
) {
    void projectId
    void remote
    void baseBranch
    void headBranch
    return true
}
