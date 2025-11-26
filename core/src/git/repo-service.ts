import simpleGit, {type SimpleGit} from 'simple-git'
import type {FileChange, GitStatus} from 'shared'
import {promises as fsp} from 'fs'
import {resolve} from 'path'
import {getRepositoryPath} from '../projects/repo'
import {ensureGitAuthorIdentity} from './identity'

export async function getRepoPath(projectId: string): Promise<string> {
    const path = await getRepositoryPath(projectId)
    if (!path) throw new Error('Project not found')
    return path
}

function git(repoPath: string): SimpleGit {
    return simpleGit({baseDir: repoPath})
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
            const [aheadStr, behindStr] = out.trim().split(/\s+/)
            ahead = Number(aheadStr || 0)
            behind = Number(behindStr || 0)
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

type CommitOptions = {
    /**
     * Stage the full worktree (including deletions) before committing.
     * Defaults to true so commit helpers always capture all changes unless explicitly disabled.
     */
    stageAll?: boolean
}

export async function commitWithHash(
    g: SimpleGit,
    message: string,
    options: CommitOptions = {},
): Promise<string> {
    const {stageAll = true} = options

    if (stageAll) {
        // Stage everything (including deletions) to guarantee complete commits
        await g.add(['-A'])
    }

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
    return commitWithHash(g, message, {stageAll: true})
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

    const args: string[] = []
    if (token) {
        const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
        args.push('-c', `http.extraHeader=Authorization: Basic ${basic}`)
    }
    args.push('push')
    if (setUpstream) args.push('-u')
    args.push(targetRemote, targetBranch)

    await g.raw(args)
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
