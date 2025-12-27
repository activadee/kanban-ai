import {eq} from 'drizzle-orm'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'
import {cardPlans, type CardPlanRow} from '../db/schema'
import type {SavePlanInput} from 'shared'

export async function getPlanForCard(cardId: string, executor?: DbExecutor): Promise<CardPlanRow | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(cardPlans).where(eq(cardPlans.cardId, cardId)).limit(1)
    return row ?? null
}

export async function savePlan(
    boardId: string,
    cardId: string,
    input: SavePlanInput,
    executor?: DbExecutor,
): Promise<CardPlanRow> {
    const database = resolveDb(executor)
    const now = new Date()
    const planMarkdown = input.planMarkdown

    await database
        .insert(cardPlans)
        .values({
            id: `plan-${crypto.randomUUID()}`,
            boardId,
            cardId,
            planMarkdown,
            sourceMessageId: input.sourceMessageId ?? null,
            sourceAttemptId: input.sourceAttemptId ?? null,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: cardPlans.cardId,
            set: {
                boardId,
                planMarkdown,
                sourceMessageId: input.sourceMessageId ?? null,
                sourceAttemptId: input.sourceAttemptId ?? null,
                updatedAt: now,
            },
        })
        .run()

    const row = await getPlanForCard(cardId, database)
    if (!row) throw new Error('Failed to save plan')
    return row
}

export async function deletePlan(cardId: string, executor?: DbExecutor): Promise<boolean> {
    const database = resolveDb(executor)
    const result = await database.delete(cardPlans).where(eq(cardPlans.cardId, cardId)).run()
    if (typeof result === 'object' && result !== null && 'changes' in result) {
        const changes = (result as {changes?: unknown}).changes
        if (typeof changes === 'number') return changes > 0
    }
    return true
}

