import {projectsService, githubRepo, getGitOriginUrl, parseGithubOwnerRepo, projectSettingsSync} from 'core'
import type {AppEventBus} from '../events/bus'
import {log} from '../log'
import {importGithubIssues} from './import.service'

const DEFAULT_TICK_INTERVAL_SECONDS = 60

export type GithubIssueSyncSchedulerOptions = {
    events: AppEventBus
    intervalSeconds?: number
}

let tickInProgress = false

export async function runGithubIssueSyncTick(events: AppEventBus): Promise<void> {
    if (tickInProgress) return
    tickInProgress = true
    try {
        const connection = await githubRepo.getGithubConnection()
        if (!connection) return

        const projects = await projectsService.list()
        const now = new Date()

        for (const project of projects) {
            try {
                const settings = await projectsService.getSettings(project.id)
                if (!projectSettingsSync.isGithubIssueSyncEnabled(settings)) continue
                if (!projectSettingsSync.isGithubIssueSyncDue(settings, now)) continue

                const lockAcquired = await projectSettingsSync.tryStartGithubIssueSync(project.id, now)
                if (!lockAcquired) continue

                const originUrl = await getGitOriginUrl(project.repositoryPath)
                if (!originUrl) {
                    log.warn('github:sync', 'No GitHub origin; skipping project', {
                        projectId: project.id,
                        boardId: project.boardId,
                    })
                    await projectSettingsSync.completeGithubIssueSync(project.id, 'failed', new Date())
                    continue
                }

                const parsed = parseGithubOwnerRepo(originUrl)
                if (!parsed) {
                    log.warn('github:sync', 'Origin is not a GitHub repo; skipping project', {
                        projectId: project.id,
                        boardId: project.boardId,
                        originUrl,
                    })
                    await projectSettingsSync.completeGithubIssueSync(project.id, 'failed', new Date())
                    continue
                }

                const state = settings.githubIssueSyncState ?? 'open'

                try {
                    const result = await importGithubIssues(
                        {
                            boardId: project.boardId,
                            owner: parsed.owner,
                            repo: parsed.repo,
                            state,
                        },
                        {
                            bus: events,
                            logContext: {
                                projectId: project.id,
                                boardId: project.boardId,
                                owner: parsed.owner,
                                repo: parsed.repo,
                                state,
                                trigger: 'scheduled',
                            },
                        },
                    )

                    await projectSettingsSync.completeGithubIssueSync(project.id, 'succeeded', new Date())

                    log.info('github:sync', 'Scheduled sync completed', {
                        projectId: project.id,
                        boardId: project.boardId,
                        owner: parsed.owner,
                        repo: parsed.repo,
                        imported: result.imported,
                        updated: result.updated,
                        skipped: result.skipped,
                    })
                } catch (error) {
                    log.error('github:sync', 'Scheduled sync failed', {
                        err: error,
                        projectId: project.id,
                        boardId: project.boardId,
                        owner: parsed.owner,
                        repo: parsed.repo,
                        state,
                    })
                    await projectSettingsSync.completeGithubIssueSync(project.id, 'failed', new Date())
                }
            } catch (error) {
                log.error('github:sync', 'Unexpected error during scheduled sync for project', {
                    err: error,
                    projectId: project.id,
                    boardId: project.boardId,
                })
            }
        }
    } finally {
        tickInProgress = false
    }
}

export function startGithubIssueSyncScheduler(options: GithubIssueSyncSchedulerOptions): { stop: () => void } {
    const intervalSeconds = options.intervalSeconds ?? DEFAULT_TICK_INTERVAL_SECONDS
    const intervalMs = intervalSeconds * 1000

    const timer = setInterval(() => {
        void runGithubIssueSyncTick(options.events)
    }, intervalMs)

    return {
        stop: () => {
            clearInterval(timer)
        },
    }
}

