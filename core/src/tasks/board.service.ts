import type {BoardState} from 'shared'
import {withRepoTx, getGithubRepo} from '../repos/provider'
import {listColumnsForBoard, listCardsForColumns, getBoardById} from '../projects/repo'
import {listDependenciesForCards} from '../projects/dependencies'
import {publishTaskEvent} from './events'

const DEFAULT_COLUMNS = [
    {title: 'Backlog'},
    {title: 'In Progress'},
    {title: 'Review'},
    {title: 'Done'},
]

function toIso(value: Date | string | number | null | undefined) {
    if (!value) return new Date().toISOString()
    if (value instanceof Date) return value.toISOString()
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export async function ensureDefaultColumns(boardId: string) {
    const existing = await listColumnsForBoard(boardId)
    if (existing.length > 0) return

    const createdIds: string[] = []
    await withRepoTx(async (provider) => {
        const now = new Date()
        for (const [index, item] of DEFAULT_COLUMNS.entries()) {
            const columnId = `col-${crypto.randomUUID()}`
            await provider.projects.insertColumn({
                id: columnId,
                title: item.title,
                order: index,
                boardId,
                createdAt: now,
                updatedAt: now,
            })
            createdIds.push(columnId)
        }
    })

    if (createdIds.length > 0) {
        publishTaskEvent('board.columns.initialized', {boardId, columnIds: createdIds})
    }
}

export async function getBoardState(boardId: string): Promise<BoardState> {
    await ensureDefaultColumns(boardId)

    const columnRows = await listColumnsForBoard(boardId)
    const columnIds = columnRows.map((col) => col.id)
    const cardRows = await listCardsForColumns(columnIds)
    const depMap = await listDependenciesForCards(cardRows.map((c) => c.id))

    const cardIds = cardRows.map((c) => c.id)
    const githubIssueMap = new Map<string, {issueNumber: number; url: string}>()
    if (cardIds.length > 0) {
        try {
            const github = getGithubRepo()
            for (const cardId of cardIds) {
                const mapping = await github.findGithubIssueMappingByCardId(cardId)
                if (mapping && !githubIssueMap.has(cardId)) {
                    githubIssueMap.set(cardId, {
                        issueNumber: mapping.issueNumber,
                        url: mapping.url,
                    })
                }
            }
        } catch {
            // DB provider not set; ignore GitHub issue metadata in this context
        }
    }

    const boardState: BoardState = {
        columns: {},
        columnOrder: [],
        cards: {},
    }

    for (const column of columnRows) {
        boardState.columns[column.id] = {
            id: column.id,
            title: column.title,
            cardIds: [],
        }
        boardState.columnOrder.push(column.id)
    }

    for (const card of cardRows) {
        const column = boardState.columns[card.columnId]
        if (!column) continue
        column.cardIds.push(card.id)
        boardState.cards[card.id] = {
            id: card.id,
            ticketKey: card.ticketKey ?? undefined,
            prUrl: card.prUrl ?? undefined,
            disableAutoCloseOnPRMerge: Boolean(card.disableAutoCloseOnPRMerge),
            ticketType: card.ticketType ?? null,
            isEnhanced: card.isEnhanced ?? false,
            githubIssue: githubIssueMap.get(card.id),
            title: card.title,
            description: card.description ?? undefined,
            dependsOn: depMap.get(card.id) ?? undefined,
            createdAt: toIso(card.createdAt),
            updatedAt: toIso(card.updatedAt),
        }
    }

    return boardState
}

export async function createDefaultBoardStructure(boardId: string) {
    await ensureDefaultColumns(boardId)
}

export async function broadcastBoard(boardId: string) {
    const board = await getBoardState(boardId)
    publishTaskEvent('board.state.changed', {boardId, state: board})
}

export async function ensureBoardExists(boardId: string) {
    const existing = await getBoardById(boardId)
    if (!existing) throw new Error('Board not found')
    await ensureDefaultColumns(boardId)
}
