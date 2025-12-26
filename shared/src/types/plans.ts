export type CardPlan = {
    id: string
    cardId: string
    boardId: string
    planMarkdown: string
    sourceMessageId?: string | null
    sourceAttemptId?: string | null
    createdAt: string
    updatedAt: string
}

export type SavePlanInput = {
    planMarkdown: string
    sourceMessageId?: string
    sourceAttemptId?: string
}

