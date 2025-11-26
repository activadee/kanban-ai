import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {attempts, git, type FileSource, githubRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'

const {
    getFileContentAtPath,
    getStatusAgainstBaseAtPath,
    resolveBaseAncestorAtPath,
    commitAtPath,
    pushAtPath,
    mergeBranchIntoBaseForProject,
} = git
const {getGithubConnection} = githubRepo

export async function gitStatusHandler(c: any) {
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
    try {
        const {projects} = c.get('services')
        const settings = await projects.ensureSettings(attempt.boardId)
        const remote = settings.preferredRemote?.trim() || undefined
        const baseAncestor = await resolveBaseAncestorAtPath(attempt.worktreePath, attempt.baseBranch || undefined, remote)
        const status = await getStatusAgainstBaseAtPath(attempt.worktreePath, baseAncestor)
        return c.json(status, 200)
    } catch (error) {
        log.error({err: error, attemptId: attempt.id, boardId: attempt.boardId}, '[attempts:git:status] failed')
        return problemJson(c, {status: 502, detail: 'Failed to get git status'})
    }
}

export async function gitFileHandler(c: any) {
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
    const path = c.req.query('path') || ''
    if (!path) return problemJson(c, {status: 400, detail: 'Missing path'})
    const source = (c.req.query('source') || 'worktree') as FileSource
    try {
        let ref: string | undefined = undefined
        if (source === 'base') {
            const {projects} = c.get('services')
            const settings = await projects.ensureSettings(attempt.boardId)
            const remote = settings.preferredRemote?.trim() || undefined
            ref = await resolveBaseAncestorAtPath(attempt.worktreePath, attempt.baseBranch || undefined, remote)
        }
        const content = await getFileContentAtPath(attempt.worktreePath, path, source, ref)
        return c.json({content}, 200)
    } catch (error) {
        log.error(
            {err: error, attemptId: attempt.id, boardId: attempt.boardId, path, source},
            '[attempts:git:file] failed',
        )
        return problemJson(c, {status: 502, detail: 'Failed to fetch file content'})
    }
}

export async function gitCommitHandler(c: any) {
    const {subject, body} = c.req.valid('json') as {subject: string; body?: string}
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
    try {
        const shortSha = await commitAtPath(attempt.worktreePath, subject, body, {
            projectId: attempt.boardId,
            attemptId: attempt.id,
        })
        return c.json({shortSha}, 200)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Commit failed'
        return problemJson(c, {status: 422, detail: message})
    }
}

export async function gitPushHandler(c: any) {
    const {setUpstream} = c.req.valid('json') as {setUpstream?: boolean}
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    if (!attempt.worktreePath) return problemJson(c, {status: 409, detail: 'No worktree for attempt'})
    const {projects} = c.get('services')
    const settings = await projects.ensureSettings(attempt.boardId)
    const remote = settings.preferredRemote?.trim() || 'origin'
    const auth = await getGithubConnection().catch(() => null)
    try {
        await pushAtPath(
            attempt.worktreePath,
            {remote, branch: attempt.branchName, token: auth?.accessToken || undefined, setUpstream},
            {projectId: attempt.boardId, attemptId: attempt.id},
        )
        return c.json({remote, branch: attempt.branchName}, 200)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Push failed'
        const status: ContentfulStatusCode =
            message.toLowerCase().includes('auth') || message.toLowerCase().includes('permission') ? 401 : 502
        return problemJson(c, {status, detail: message})
    }
}

export async function gitMergeHandler(c: any) {
    const attempt = await attempts.getAttempt(c.req.param('id'))
    if (!attempt) return problemJson(c, {status: 404, detail: 'Attempt not found'})
    const {projects} = c.get('services')
    const settings = await projects.ensureSettings(attempt.boardId)
    const remote = settings.preferredRemote?.trim() || 'origin'
    const events = c.get('events')
    try {
        const baseBranch = attempt.baseBranch || 'main'
        const headBranch = attempt.branchName
        await mergeBranchIntoBaseForProject(attempt.boardId, {remote, baseBranch, headBranch})
        const ts = new Date().toISOString()
        const message = `[git] merged ${headBranch} into ${baseBranch}`
        events.publish('attempt.log.appended', {
            attemptId: attempt.id,
            boardId: attempt.boardId,
            level: 'info',
            message,
            ts,
        })
        events.publish('git.merge.completed', {
            projectId: attempt.boardId,
            attemptId: attempt.id,
            result: {merged: true, message},
        })
        events.publish('git.status.changed', {projectId: attempt.boardId})
        try {
            const {moveCardToColumnByTitle} = await import('../tasks/service')
            await moveCardToColumnByTitle(attempt.boardId, attempt.cardId, 'Done')
        } catch {
        }
        return c.json({ok: true, base: baseBranch}, 200)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Merge failed'
        const status: ContentfulStatusCode = message.toLowerCase().includes('conflict') ? 409 : 502
        return problemJson(c, {status, detail: message})
    }
}
