import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {attempts, git, type FileSource, githubRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'
import {gitCommitSchema, gitPushSchema} from './attempts.schemas'

const {
    getFileContentAtPath,
    getStatusAgainstBaseAtPath,
    resolveBaseAncestorAtPath,
    commitAtPath,
    pushAtPath,
    mergeBranchIntoBaseForProject,
} = git
const {getGithubConnection} = githubRepo

const attemptIdParam = z.object({id: z.string()})

export const gitStatusHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    async (c) => {
        const {id} = c.req.valid('param')
        const attempt = await attempts.getAttempt(id)
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
            log.error('attempts:git', 'status failed', {err: error, attemptId: attempt.id, boardId: attempt.boardId})
            return problemJson(c, {status: 502, detail: 'Failed to get git status'})
        }
    },
)

export const gitFileHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    async (c) => {
        const {id} = c.req.valid('param')
        const attempt = await attempts.getAttempt(id)
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
            log.error('attempts:git', 'file failed', {
                err: error,
                attemptId: attempt.id,
                boardId: attempt.boardId,
                path,
                source,
            })
            return problemJson(c, {status: 502, detail: 'Failed to fetch file content'})
        }
    },
)

export const gitCommitHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    zValidator('json', gitCommitSchema),
    async (c) => {
        const {id} = c.req.valid('param')
        const {subject, body} = c.req.valid('json')
        const attempt = await attempts.getAttempt(id)
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
    },
)

export const gitPushHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    zValidator('json', gitPushSchema),
    async (c) => {
        const {id} = c.req.valid('param')
        const {setUpstream} = c.req.valid('json')
        const attempt = await attempts.getAttempt(id)
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
    },
)

export const gitMergeHandlers = createHandlers(
    zValidator('param', attemptIdParam),
    async (c) => {
        const {id} = c.req.valid('param')
        const attempt = await attempts.getAttempt(id)
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
    },
)
