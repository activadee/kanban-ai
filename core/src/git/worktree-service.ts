import simpleGit, {type SimpleGit} from 'simple-git'
import type {FileChange, GitFileStatus, GitStatus} from 'shared'
import {promises as fsp} from 'fs'
import {resolve} from 'path'
import {commitWithHash, type FileSource} from './repo-service'
import {ensureGitAuthorIdentity} from './identity'
import {publishCommitCreated, publishPushCompleted, publishStatusChanged, type GitEventMeta} from './events'

function gitAtPath(worktreePath: string): SimpleGit {
    return simpleGit({baseDir: worktreePath})
}

function parseNameStatusDiff(output: string): FileChange[] {
    // --name-status -z emits tokens separated by NUL: <status>\0<path>\0[old\0new\0]
    const tokens = output.split('\0').filter((t) => t.length > 0)
    const files: FileChange[] = []

    for (let i = 0; i < tokens.length; ) {
        const statusToken = tokens[i++]
        if (!statusToken) continue

        const letter = (statusToken[0] || 'M') as GitFileStatus

        if (letter === 'R' || letter === 'C') {
            const oldPath = tokens[i++]
            const newPath = tokens[i++]
            const path = newPath || oldPath
            if (!path) continue
            files.push({path, oldPath: oldPath || undefined, status: letter, staged: false})
            continue
        }

        const path = tokens[i++]
        if (!path) continue
        files.push({path, status: letter, staged: false})
    }

    return files
}

function mergeUntracked(files: FileChange[], untracked: string[]): FileChange[] {
    const map = new Map<string, FileChange>()
    for (const f of files) map.set(f.path, f)
    for (const path of untracked || []) {
        if (!map.has(path)) {
            map.set(path, {path, status: '?', staged: false})
        }
    }
    return Array.from(map.values())
}

function applyStagedFlags(files: FileChange[], status: Awaited<ReturnType<SimpleGit['status']>>): FileChange[] {
    const stagedLookup = new Map<string, boolean>()
    for (const f of status.files) {
        const stagedFlag = f.index.trim()
        const staged = Boolean(stagedFlag && stagedFlag !== ' ')
        if (staged) stagedLookup.set(f.path, true)
    }

    return files.map((f) => ({
        ...f,
        staged: stagedLookup.get(f.path) ?? f.staged ?? false,
    }))
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

    const baseRef = baseAncestorRef?.trim() || 'HEAD'

    let diffFiles: FileChange[] = []
    try {
        const rawDiff = await g.raw(['diff', '--name-status', '-z', '--find-renames', '--find-copies', baseRef])
        diffFiles = parseNameStatusDiff(rawDiff)
    } catch {
        // fall back to simple status listing if diff fails (e.g., shallow clone issues)
        diffFiles = status.files.map((f) => {
            const stagedFlag = f.index.trim()
            const worktreeFlag = f.working_dir.trim()
            const letter = (stagedFlag || worktreeFlag || 'M') as FileChange['status']
            const change: FileChange = {
                path: f.path,
                status: (letter as any) ?? 'M',
                staged: Boolean(stagedFlag && stagedFlag !== ' '),
            }
            if (f.from && f.from !== f.path) change.oldPath = f.from
            return change
        })
    }

    const filesWithUntracked = mergeUntracked(diffFiles, status.not_added || [])
    const files = applyStagedFlags(filesWithUntracked, status).sort((a, b) => a.path.localeCompare(b.path))

    let ahead = 0
    let behind = 0
    try {
        const out = await g.raw(['rev-list', '--left-right', '--count', `${baseRef}...HEAD`])
        const [behindStr, aheadStr] = out.trim().split(/\s+/)
        behind = Number(behindStr || 0)
        ahead = Number(aheadStr || 0)
    } catch {
    }

    const summary = {
        added: 0,
        modified: 0,
        deleted: 0,
        untracked: 0,
        staged: files.filter((f) => f.staged).length,
    }

    for (const f of files) {
        switch (f.status) {
            case 'A':
            case 'C':
                summary.added += 1
                break
            case 'D':
                summary.deleted += 1
                break
            case '?':
                summary.untracked += 1
                break
            default:
                summary.modified += 1
                break
        }
    }

    const hasUncommitted =
        (status.files?.length || 0) +
        (status.not_added?.length || 0) > 0

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

export async function commitAtPath(
    worktreePath: string,
    subject: string,
    body?: string,
    meta?: GitEventMeta,
): Promise<string> {
    const g = gitAtPath(worktreePath)
    const message = body?.trim() ? `${subject.trim()}\n\n${body.trim()}` : subject.trim()
    await ensureGitAuthorIdentity(g)
    const sha = await commitWithHash(g, message, {stageAll: true})
    const ts = new Date().toISOString()
    publishCommitCreated(meta, sha, subject.trim(), ts)
    publishStatusChanged(meta)
    return sha
}

export function isPushConflictError(error: Error): boolean {
    const conflictPatterns = [
        /rejected.*non-fast-forward/i,
        /failed to push.*updates were rejected/i,
        /fetch first/i,
        /\[rejected\]/i,
    ]
    const errorMessage = error.message + ((error as any).stderr ?? '')
    return conflictPatterns.some(pattern => pattern.test(errorMessage))
}

export async function pullRebaseAtPath(
    worktreePath: string
): Promise<{
    success: boolean
    hasConflicts: boolean
    message: string
}> {
    const g = gitAtPath(worktreePath)
    try {
        await g.raw(['pull', '--rebase'])
        return {
            success: true,
            hasConflicts: false,
            message: 'Rebase completed successfully',
        }
    } catch (error) {
        const errorMessage = (error as Error).message + ((error as any).stderr ?? '')
        
        const conflictPatterns = [
            /conflict/i,
            /could not apply/i,
            /Resolve all conflicts/i,
            /needs merge/i,
            /cannot rebase/i,
        ]
        const hasConflicts = conflictPatterns.some(pattern => pattern.test(errorMessage))
        
        if (hasConflicts) {
            try {
                await g.raw(['rebase', '--abort'])
                return {
                    success: false,
                    hasConflicts: true,
                    message: 'Rebase has conflicts and was aborted',
                }
            } catch (abortError) {
                try {
                    await g.raw(['reset', '--hard', 'HEAD'])
                    await g.raw(['clean', '-fd'])
                    return {
                        success: false,
                        hasConflicts: true,
                        message: `Rebase abort failed but repository was reset to clean state. Original error: ${(abortError as Error).message}`,
                    }
                } catch (resetError) {
                    return {
                        success: false,
                        hasConflicts: true,
                        message: `Failed to abort rebase after conflicts detected. Repository may be in an inconsistent state. Manual intervention required: ${(abortError as Error).message}`,
                    }
                }
            }
        }
        
        return {
            success: false,
            hasConflicts: false,
            message: `Rebase failed: ${(error as Error).message}`,
        }
    }
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

    const args: string[] = []
    if (token) {
        const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
        args.push('-c', `http.extraHeader=Authorization: Basic ${basic}`)
    }
    args.push('push')
    if (setUpstream) args.push('-u')
    args.push(targetRemote, targetBranch)

    await g.raw(args)

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

