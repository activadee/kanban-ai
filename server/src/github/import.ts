import {fetchRepoIssues} from './api'
import {projectTickets, projectsRepo, githubRepo, withTx} from 'core'
import type {AppEventBus} from '../events/bus'

const {listColumnsForBoard, listCardsForColumns, insertCard, updateCard, getBoardById} = projectsRepo
const {findGithubIssueMapping, insertGithubIssueMapping, updateGithubIssueMapping} = githubRepo

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

async function ensureBacklogColumn(boardId: string, executor?: Parameters<typeof listColumnsForBoard>[1]) {
    const columns = await listColumnsForBoard(boardId, executor)
    if (!columns.length) throw new Error('Board has no columns')
    return columns[0]!.id
}

export async function importGithubIssues(params: ImportIssuesParams, options?: {
    bus?: AppEventBus
}): Promise<ImportIssuesResult> {
    const state = params.state ?? 'open'
    const board = await getBoardById(params.boardId)
    if (!board) throw new Error('Board not found')

    const backlogColumnId = await ensureBacklogColumn(params.boardId)
    const issues = await fetchRepoIssues(params.owner, params.repo, state)

    let imported = 0
    let updated = 0
    let skipped = 0

    const now = new Date()

    await withTx(async (tx) => {
        for (const issue of issues) {
            const mapping = await findGithubIssueMapping(params.boardId, params.owner, params.repo, issue.number, tx)

            if (!mapping) {
                const existingCards = await listCardsForColumns([backlogColumnId], tx)
                const nextOrder = existingCards.length
                const cardId = `card-${crypto.randomUUID()}`

                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const {key} = await projectTickets.reserveNextTicketKey(tx, params.boardId, now)
                        await insertCard(
                            {
                                id: cardId,
                                title: issue.title,
                                description: issue.body ?? null,
                                order: nextOrder,
                                columnId: backlogColumnId,
                                boardId: params.boardId,
                                ticketKey: key,
                                createdAt: now,
                                updatedAt: now,
                            },
                            tx,
                        )
                        break
                    } catch (error) {
                        if (projectTickets.isUniqueTicketKeyError(error) && attempt < 2) continue
                        throw error
                    }
                }

                await insertGithubIssueMapping(
                    {
                        id: `ghi-${crypto.randomUUID()}`,
                        boardId: params.boardId,
                        cardId,
                        owner: params.owner,
                        repo: params.repo,
                        issueId: String(issue.id),
                        issueNumber: issue.number,
                        titleSnapshot: issue.title,
                        url: issue.html_url,
                        state: issue.state,
                        createdAt: now,
                        updatedAt: now,
                    },
                    tx,
                )

                imported += 1
            } else {
                let didUpdate = false
                if (mapping.titleSnapshot !== issue.title || mapping.state !== issue.state) {
                    await updateGithubIssueMapping(
                        mapping.id,
                        {titleSnapshot: issue.title, state: issue.state, updatedAt: now},
                        tx,
                    )
                    didUpdate = true
                }

                await updateCard(
                    mapping.cardId,
                    {title: issue.title, description: issue.body ?? null, boardId: params.boardId, updatedAt: now},
                    tx,
                )

                if (didUpdate) {
                    updated += 1
                } else {
                    skipped += 1
                }
            }
        }
    })

    const result = {imported, updated, skipped}
    options?.bus?.publish('github.issues.imported', {
        projectId: params.boardId,
        importedCount: imported,
    })
    return result
}
