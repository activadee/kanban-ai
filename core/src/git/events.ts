import type {AppEventBus} from '../events/bus'

export type GitEventMeta = {
    projectId?: string
    attemptId?: string
}

let gitEvents: AppEventBus | null = null

export function bindGitEventBus(bus: AppEventBus) {
    gitEvents = bus
}

export function publishStatusChanged(meta?: GitEventMeta) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.status.changed', {projectId: meta.projectId})
}

export function publishCommitCreated(
    meta: GitEventMeta | undefined,
    shortSha: string,
    subject: string,
    ts: string,
) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.commit.created', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        shortSha,
        subject,
        ts,
    })
}

export function publishPushCompleted(
    meta: GitEventMeta | undefined,
    remote: string,
    branch: string,
    ts: string,
) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.push.completed', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        remote,
        branch,
        ts,
    })
}

export function publishMergeCompleted(meta: GitEventMeta | undefined, merged: boolean, message: string) {
    if (!gitEvents || !meta?.projectId) return
    gitEvents.publish('git.merge.completed', {
        projectId: meta.projectId,
        attemptId: meta.attemptId,
        result: {merged, message},
    })
}

