import {fetchRepoIssues} from './api'
import {projectTickets, projectsRepo, githubRepo, withRepoTx} from 'core'
import type {AppEventBus} from '../events/bus'
import {log} from '../log'

const {listColumnsForBoard, listCardsForColumns, getBoardById, getCardById} = projectsRepo
const {findGithubIssueMapping} = githubRepo

export type ImportIssuesParams = {
    boardId: string
    owner: string
    repo: string
    state?: 'open' | 'closed' | 'all'
}

export type ImportIssuesResult = {
    imported: number
    updated: number
    skipped: number
}

async function ensureBacklogColumn(boardId: string) {
    const columns = await listColumnsForBoard(boardId)
    if (!columns.length) throw new Error('Board has no columns')
    return columns[0]!.id
}

export async function importGithubIssues(
    params: ImportIssuesParams,
    options?: {
        bus?: AppEventBus
        logContext?: {
            projectId: string
            boardId: string
            owner: string
            repo: string
            state: 'open' | 'closed' | 'all'
            trigger?: string
        }
    },
): Promise<ImportIssuesResult> {
    const state = params.state ?? 'open'
    const board = await getBoardById(params.boardId)
    if (!board) throw new Error('Board not found')

    const backlogColumnId = await ensureBacklogColumn(params.boardId)
    const issues = await fetchRepoIssues(params.owner, params.repo, state)

    let imported = 0
    let updated = 0
    let skipped = 0

    const now = new Date()

    const baseLogContext = options?.logContext

    if (baseLogContext) {
        log.info('github:sync', `Syncing issues from ${board.name} (${params.owner}/${params.repo})`, {
            projectId: baseLogContext.projectId,
            boardId: baseLogContext.boardId,
            owner: params.owner,
            repo: params.repo,
            state,
            trigger: baseLogContext.trigger ?? 'scheduled',
        })
    }

    await withRepoTx(async (provider) => {
        for (const issue of issues) {
            const mapping = await findGithubIssueMapping(params.boardId, params.owner, params.repo, issue.number)

            if (!mapping) {
                if (baseLogContext) {
                    log.info('github:sync', `Syncing issue #${issue.number} (${issue.title})`, {
                        ...baseLogContext,
                        issueNumber: issue.number,
                        issueId: String(issue.id),
                        state: issue.state,
                        htmlUrl: issue.html_url,
                        action: 'create',
                    })
                }

                const existingCards = await listCardsForColumns([backlogColumnId])
                const nextOrder = existingCards.length
                const cardId = `card-${crypto.randomUUID()}`
                let ticketKey: string | null = null

                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const {key} = await projectTickets.reserveNextTicketKey(params.boardId, now)
                        ticketKey = key
                        await provider.projects.insertCard({
                            id: cardId,
                            title: issue.title,
                            description: issue.body ?? null,
                            order: nextOrder,
                            columnId: backlogColumnId,
                            boardId: params.boardId,
                            ticketKey: key,
                            createdAt: now,
                            updatedAt: now,
                        })
                        break
                    } catch (error) {
                        if (projectTickets.isUniqueTicketKeyError(error) && attempt < 2) continue
                        throw error
                    }
                }

                await provider.github.insertGithubIssueMapping({
                    id: `ghi-${crypto.randomUUID()}`,
                    boardId: params.boardId,
                    cardId,
                    owner: params.owner,
                    repo: params.repo,
                    direction: 'imported',
                    issueId: String(issue.id),
                    issueNumber: issue.number,
                    titleSnapshot: issue.title,
                    url: issue.html_url,
                    state: issue.state,
                    createdAt: now,
                    updatedAt: now,
                })

                if (baseLogContext) {
                    log.info('github:sync', `Synced issue as ${ticketKey ?? 'unknown'} in ${board.name}`, {
                        ...baseLogContext,
                        ticketKey: ticketKey,
                        cardId,
                        boardId: params.boardId,
                    })
                }

                imported += 1
            } else {
                let didUpdate = false
                if (mapping.titleSnapshot !== issue.title || mapping.state !== issue.state) {
                    await provider.github.updateGithubIssueMapping(
                        mapping.id,
                        {titleSnapshot: issue.title, state: issue.state, updatedAt: now},
                    )
                    didUpdate = true
                }

                if (baseLogContext) {
                    log.info('github:sync', `Syncing issue #${issue.number} (${issue.title})`, {
                        ...baseLogContext,
                        issueNumber: issue.number,
                        issueId: String(issue.id),
                        state: issue.state,
                        htmlUrl: issue.html_url,
                        action: 'update',
                    })
                }

                await provider.projects.updateCard(
                    mapping.cardId,
                    {
                        title: issue.title,
                        description: issue.body ?? null,
                        boardId: params.boardId,
                        updatedAt: now,
                    },
                )

                if (baseLogContext) {
                    // Best-effort: fetch ticket key for logging
                    const card = await getCardById(mapping.cardId)
                    const ticketKey = card?.ticketKey ?? null
                    log.info('github:sync', `Synced issue as ${ticketKey ?? 'unknown'} in ${board.name}`, {
                        ...baseLogContext,
                        ticketKey,
                        cardId: mapping.cardId,
                        boardId: params.boardId,
                    })
                }

                if (didUpdate) {
                    updated += 1
                } else {
                    skipped += 1
                }
            }
        }
    })

    const result = {imported, updated, skipped}

    if (baseLogContext) {
        log.info('github:sync', `Found ${imported} issues that are new`, {
            projectId: baseLogContext.projectId,
            boardId: baseLogContext.boardId,
            owner: params.owner,
            repo: params.repo,
            newCount: imported,
            updatedCount: updated,
            skippedCount: skipped,
        })
    }

    options?.bus?.publish('github.issues.imported', {
        projectId: params.boardId,
        importedCount: imported,
    })
    return result
}
