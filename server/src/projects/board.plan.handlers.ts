import type {Context} from 'hono'
import type {AppEnv} from '../env'
import type {BoardContext} from './board.routes'
import {problemJson} from '../http/problem'
import {projectsRepo, plansRepo, type CardPlanRow} from 'core'
import type {CardPlan} from 'shared'

const {getCardById, getColumnById} = projectsRepo

const toIso = (value: Date | string | number | null | undefined): string => {
    if (!value) return new Date().toISOString()
    if (value instanceof Date) return value.toISOString()
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function toApiPlan(row: CardPlanRow): CardPlan {
    return {
        id: row.id,
        cardId: row.cardId,
        boardId: row.boardId,
        planMarkdown: row.planMarkdown,
        sourceMessageId: row.sourceMessageId ?? null,
        sourceAttemptId: row.sourceAttemptId ?? null,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

async function ensureCardInBoard(
    c: Context<AppEnv>,
    boardId: string,
    cardId: string,
): Promise<Response | {cardId: string}> {
    const card = await getCardById(cardId)
    if (!card) return problemJson(c, {status: 404, detail: 'Card not found'})
    let cardBoardId = card.boardId ?? null
    if (!cardBoardId) {
        const column = await getColumnById(card.columnId)
        cardBoardId = column?.boardId ?? null
    }
    if (cardBoardId !== boardId) {
        return problemJson(c, {status: 400, detail: 'Card does not belong to this board'})
    }
    return {cardId}
}

export async function getCardPlanHandler(c: Context<AppEnv>, ctx: BoardContext) {
    const {boardId} = ctx
    const cardId = c.req.param('cardId')

    const guard = await ensureCardInBoard(c, boardId, cardId)
    if (guard instanceof Response) return guard

    const plan = await plansRepo.getPlanForCard(cardId)
    if (!plan) return problemJson(c, {status: 404, detail: 'Plan not found'})

    return c.json(toApiPlan(plan), 200)
}

export async function saveCardPlanHandler(c: Context<AppEnv>, ctx: BoardContext) {
    const {boardId} = ctx
    const cardId = c.req.param('cardId')

    const guard = await ensureCardInBoard(c, boardId, cardId)
    if (guard instanceof Response) return guard

    const body = (await c.req.json()) as {
        planMarkdown: string
        sourceMessageId?: string
        sourceAttemptId?: string
    }

    const saved = await plansRepo.savePlan(boardId, cardId, {
        planMarkdown: body.planMarkdown,
        sourceMessageId: body.sourceMessageId,
        sourceAttemptId: body.sourceAttemptId,
    })

    return c.json(toApiPlan(saved), 201)
}

export async function deleteCardPlanHandler(c: Context<AppEnv>, ctx: BoardContext) {
    const {boardId} = ctx
    const cardId = c.req.param('cardId')

    const guard = await ensureCardInBoard(c, boardId, cardId)
    if (guard instanceof Response) return guard

    await plansRepo.deletePlan(cardId)
    return c.body(null, 204)
}
