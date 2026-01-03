import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {projectsRepo, projectDeps, tasks, projectsService, cardImagesRepo} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createGithubIssueForCard} from '../github/export.service'
import {updateGithubIssueForCard} from '../github/export-update.service'
import {createHandlers} from '../lib/factory'
import {createCardSchema, updateCardSchema} from './project.schemas'

const {getCardById, getColumnById, listCardsForColumns} = projectsRepo
const {
    getBoardState: fetchBoardState,
    createBoardCard,
    updateBoardCard,
    deleteBoardCard,
    moveBoardCard,
    broadcastBoard,
} = tasks

const cardIdParam = z.object({cardId: z.string()})

export const createCardHandlers = createHandlers(
    zValidator('json', createCardSchema),
    async (c) => {
        const {boardId, project} = c.get('boardContext')!
        const body = c.req.valid('json')

        const column = await getColumnById(body.columnId)
        if (!column || column.boardId !== boardId) {
            return problemJson(c, {status: 404, detail: 'Column not found'})
        }

        const toUserGithubError = (error: unknown): string => {
            const message = error instanceof Error ? error.message : String(error ?? '')
            const lower = message.toLowerCase()
            if (lower.includes('not connected') || lower.includes('token')) {
                return 'GitHub is not connected. Connect GitHub and try again.'
            }
            if (lower.includes('origin') || lower.includes('github repo') || lower.includes('unsupported remote')) {
                return 'Project repository is not a GitHub repo or has no origin remote.'
            }
            if (lower.includes('persist') || lower.includes('mapping')) {
                return 'GitHub issue was created, but KanbanAI couldn\'t link it. Please re‑sync later.'
            }
            return 'Failed to create GitHub issue. Check connection and permissions.'
        }

        try {
            const cardId = await createBoardCard(
                body.columnId,
                body.title,
                body.description ?? undefined,
                body.ticketType ?? undefined,
                {suppressBroadcast: true},
            )
            if (Array.isArray(body.dependsOn) && body.dependsOn.length > 0) {
                await projectDeps.setDependencies(cardId, body.dependsOn)
            }

            if (Array.isArray(body.images) && body.images.length > 0) {
                await cardImagesRepo.setCardImages(cardId, JSON.stringify(body.images))
            }

            let githubIssueError: string | null = null
            if (body.createGithubIssue === true) {
                try {
                    const settings = await projectsService.getSettings(project.id)
                    if (!settings.githubIssueAutoCreateEnabled) {
                        githubIssueError = 'GitHub issue creation is disabled for this project.'
                    } else {
                        const createdCard = await getCardById(cardId)
                        await createGithubIssueForCard({
                            boardId,
                            cardId,
                            repositoryPath: project.repositoryPath,
                            title: body.title,
                            description: body.description ?? null,
                            ticketKey: createdCard?.ticketKey ?? null,
                        })
                    }
                } catch (error) {
                    githubIssueError = toUserGithubError(error)
                    log.warn('board:cards', 'GitHub issue create failed', {
                        err: error,
                        boardId,
                        projectId: project.id,
                        cardId,
                    })
                }
            }

            await broadcastBoard(boardId)
            const state = await fetchBoardState(boardId)
            return c.json({state, cardId, githubIssueError}, 201)
        } catch (error) {
            log.error('board:cards', 'create failed', {err: error, boardId, projectId: project.id})
            return problemJson(c, {status: 502, detail: 'Failed to create card'})
        }
    },
)

export const updateCardHandlers = createHandlers(
    zValidator('param', cardIdParam),
    zValidator('json', updateCardSchema),
    async (c) => {
        const {boardId, project} = c.get('boardContext')!
        const {cardId} = c.req.valid('param')

        const card = await getCardById(cardId)
        if (!card) return problemJson(c, {status: 404, detail: 'Card not found'})
        let cardBoardId = card.boardId ?? null
        if (!cardBoardId) {
            const column = await getColumnById(card.columnId)
            cardBoardId = column?.boardId ?? null
        }
        if (cardBoardId !== boardId) {
            return problemJson(c, {
                status: 400,
                detail: 'Card does not belong to this board',
            })
        }

        const body = c.req.valid('json')
        const wantsMove = body.columnId !== undefined || body.index !== undefined
        const hasContentUpdate =
            body.title !== undefined ||
            body.description !== undefined ||
            body.ticketType !== undefined ||
            body.isEnhanced !== undefined ||
            body.disableAutoCloseOnPRMerge !== undefined
        const hasDeps = Array.isArray(body.dependsOn)
        const hasImages = Array.isArray(body.images)
        const suppressBroadcast = wantsMove || hasDeps || hasImages

        if (wantsMove) {
            const targetColumn = await getColumnById(body.columnId!)
            if (!targetColumn || targetColumn.boardId !== boardId) {
                return problemJson(c, {
                    status: 404,
                    detail: 'Target column not found',
                })
            }

            if ((targetColumn.title || '').trim().toLowerCase() === 'in progress') {
                const {blocked} = await projectDeps.isCardBlocked(cardId)
                if (blocked) {
                    return problemJson(c, {
                        status: 409,
                        detail: 'Task is blocked by dependencies',
                    })
                }
            }
        }

        try {
            if (hasContentUpdate) {
                await updateBoardCard(
                    cardId,
                    {
                        title: body.title,
                        description: body.description ?? undefined,
                        ticketType: body.ticketType === undefined ? undefined : body.ticketType,
                        isEnhanced: body.isEnhanced,
                        disableAutoCloseOnPRMerge: body.disableAutoCloseOnPRMerge,
                    },
                    {suppressBroadcast},
                )

                if (body.title !== undefined || body.description !== undefined) {
                    try {
                        await updateGithubIssueForCard(cardId, {
                            title: body.title,
                            description: body.description === undefined ? undefined : body.description ?? null,
                        })
                    } catch (error) {
                        log.warn('board:cards', 'GitHub issue update failed', {
                            err: error,
                            boardId,
                            cardId,
                            projectId: project.id,
                        })
                    }
                }
            }

            if (hasDeps) {
                await projectDeps.setDependencies(cardId, body.dependsOn as string[])
            }

            if (hasImages) {
                await cardImagesRepo.setCardImages(cardId, JSON.stringify(body.images))
            }

            if (wantsMove) {
                const targetIndex = body.index as number
                await moveBoardCard(cardId, body.columnId!, targetIndex)

                const toIso = (value: Date | string | number | null | undefined): string => {
                    if (!value) return new Date().toISOString()
                    if (value instanceof Date) return value.toISOString()
                    const date = new Date(value)
                    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
                }

                const updatedCard = await getCardById(cardId)
                if (!updatedCard) {
                    return problemJson(c, {status: 404, detail: 'Card not found'})
                }

                let deps: string[] = []
                try {
                    deps = await projectDeps.listDependencies(cardId)
                } catch {
                    deps = []
                }

                const columnIds = Array.from(new Set([card.columnId, body.columnId!]))
                const columnRows = await Promise.all(columnIds.map((id) => getColumnById(id)))
                const columnCards = new Map<string, string[]>(columnIds.map((id) => [id, []]))
                const cardRows = await listCardsForColumns(columnIds)
                for (const row of cardRows) {
                    const list = columnCards.get(row.columnId)
                    if (!list) continue
                    list.push(row.id)
                }

                const columnsPayload: Record<string, {id: string; title: string; cardIds: string[]}> = {}
                for (const col of columnRows) {
                    if (!col) continue
                    columnsPayload[col.id] = {
                        id: col.id,
                        title: col.title,
                        cardIds: columnCards.get(col.id) ?? [],
                    }
                }

                const cardPayload = {
                    id: updatedCard.id,
                    ticketKey: updatedCard.ticketKey ?? undefined,
                    ticketType: updatedCard.ticketType ?? null,
                    isEnhanced: updatedCard.isEnhanced ?? false,
                    prUrl: updatedCard.prUrl ?? undefined,
                    disableAutoCloseOnPRMerge: updatedCard.disableAutoCloseOnPRMerge ?? false,
                    title: updatedCard.title,
                    description: updatedCard.description ?? undefined,
                    dependsOn: deps.length ? deps : undefined,
                    createdAt: toIso(updatedCard.createdAt),
                    updatedAt: toIso(updatedCard.updatedAt),
                }

                return c.json({card: cardPayload, columns: columnsPayload}, 200)
            }

            if (hasDeps || hasImages) {
                await broadcastBoard(boardId)
            }
            const state = await fetchBoardState(boardId)
            return c.json({state}, 200)
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to update card'
            log.error('board:cards', 'update failed', {err: error, boardId, cardId})
            const status = msg === 'dependency_board_mismatch' || msg === 'dependency_cycle' ? 400 : 502
            return problemJson(c, {status, detail: msg})
        }
    },
)

export const deleteCardHandlers = createHandlers(
    zValidator('param', cardIdParam),
    async (c) => {
        const {boardId} = c.get('boardContext')!
        const {cardId} = c.req.valid('param')

        const card = await getCardById(cardId)
        if (!card) return problemJson(c, {status: 404, detail: 'Card not found'})
        let cardBoardId = card.boardId ?? null
        if (!cardBoardId) {
            const column = await getColumnById(card.columnId)
            cardBoardId = column?.boardId ?? null
        }
        if (cardBoardId !== boardId) {
            return problemJson(c, {
                status: 400,
                detail: 'Card does not belong to this board',
            })
        }

        try {
            await deleteBoardCard(cardId)
            await broadcastBoard(boardId)
            return c.body(null, 204)
        } catch (error) {
            log.error('board:cards', 'delete failed', {err: error, boardId, cardId})
            return problemJson(c, {
                status: 502,
                detail: 'Failed to delete card',
            })
        }
    },
)

export const getCardImagesHandlers = createHandlers(
    zValidator('param', cardIdParam),
    async (c) => {
        const {boardId} = c.get('boardContext')!
        const {cardId} = c.req.valid('param')

        const card = await getCardById(cardId)
        if (!card) return problemJson(c, {status: 404, detail: 'Card not found'})
        let cardBoardId = card.boardId ?? null
        if (!cardBoardId) {
            const column = await getColumnById(card.columnId)
            cardBoardId = column?.boardId ?? null
        }
        if (cardBoardId !== boardId) {
            return problemJson(c, {
                status: 400,
                detail: 'Card does not belong to this board',
            })
        }

        try {
            const row = await cardImagesRepo.getCardImages(cardId)
            if (!row) {
                return c.json({images: []}, 200)
            }
            const images = JSON.parse(row.imagesJson)
            return c.json({images}, 200)
        } catch (error) {
            log.error('board:cards', 'get images failed', {err: error, boardId, cardId})
            return problemJson(c, {
                status: 502,
                detail: 'Failed to get card images',
            })
        }
    },
)

export const createCardGithubIssueHandlers = createHandlers(
    zValidator('param', cardIdParam),
    async (c) => {
        const {boardId, project} = c.get('boardContext')!
        const {cardId} = c.req.valid('param')

        const card = await getCardById(cardId)
        if (!card) return problemJson(c, {status: 404, detail: 'Card not found'})
        let cardBoardId = card.boardId ?? null
        if (!cardBoardId) {
            const column = await getColumnById(card.columnId)
            cardBoardId = column?.boardId ?? null
        }
        if (cardBoardId !== boardId) {
            return problemJson(c, {
                status: 400,
                detail: 'Card does not belong to this board',
            })
        }

        const toUserGithubError = (error: unknown): string => {
            const message = error instanceof Error ? error.message : String(error ?? '')
            const lower = message.toLowerCase()
            if (lower.includes('not connected') || lower.includes('token')) {
                return 'GitHub is not connected. Connect GitHub and try again.'
            }
            if (lower.includes('origin') || lower.includes('github repo') || lower.includes('unsupported remote')) {
                return 'Project repository is not a GitHub repo or has no origin remote.'
            }
            if (lower.includes('persist') || lower.includes('mapping')) {
                return 'GitHub issue was created, but KanbanAI couldn\'t link it. Please re‑sync later.'
            }
            return 'Failed to create GitHub issue. Check connection and permissions.'
        }

        try {
            const settings = await projectsService.getSettings(project.id)
            if (!settings.githubIssueAutoCreateEnabled) {
                return problemJson(c, {
                    status: 400,
                    detail: 'GitHub issue creation is disabled for this project.',
                })
            }

            const result = await createGithubIssueForCard({
                boardId,
                cardId,
                repositoryPath: project.repositoryPath,
                title: card.title,
                description: card.description ?? null,
                ticketKey: card.ticketKey ?? null,
            })

            return c.json({issueNumber: result.issueNumber, url: result.url}, 201)
        } catch (error) {
            const errorMessage = toUserGithubError(error)
            log.warn('board:cards', 'GitHub issue create failed', {
                err: error,
                boardId,
                projectId: project.id,
                cardId,
            })
            return problemJson(c, {
                status: 502,
                detail: errorMessage,
            })
        }
    },
)
