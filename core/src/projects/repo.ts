import {getProjectsRepo} from '../repos/provider'
import type {
    BoardRow,
    BoardInsert,
    ColumnRow,
    ColumnInsert,
    CardRow,
    CardInsert,
} from '../db/types'
import type {CardWithColumnBoard, BoardUpdate, ColumnUpdate, CardUpdate} from '../repos/interfaces'

export type {BoardInsert, BoardUpdate, ColumnInsert, CardInsert, CardUpdate, CardWithColumnBoard}

export async function listBoards(): Promise<BoardRow[]> {
    return getProjectsRepo().listBoards()
}

export async function getBoardById(id: string): Promise<BoardRow | null> {
    return getProjectsRepo().getBoardById(id)
}

export async function listBoardIds(): Promise<string[]> {
    return getProjectsRepo().listBoardIds()
}

export async function getRepositoryPath(boardId: string): Promise<string | null> {
    return getProjectsRepo().getRepositoryPath(boardId)
}

export async function insertBoard(values: BoardInsert): Promise<void> {
    return getProjectsRepo().insertBoard(values)
}

export async function updateBoard(id: string, patch: BoardUpdate): Promise<void> {
    return getProjectsRepo().updateBoard(id, patch)
}

export async function deleteBoard(id: string): Promise<void> {
    return getProjectsRepo().deleteBoard(id)
}

export async function listColumnsForBoard(boardId: string): Promise<ColumnRow[]> {
    return getProjectsRepo().listColumnsForBoard(boardId)
}

export async function getColumnById(columnId: string): Promise<ColumnRow | null> {
    return getProjectsRepo().getColumnById(columnId)
}

export async function insertColumn(values: ColumnInsert): Promise<void> {
    return getProjectsRepo().insertColumn(values)
}

export async function updateColumn(columnId: string, patch: ColumnUpdate): Promise<void> {
    return getProjectsRepo().updateColumn(columnId, patch)
}

export async function listCardsForColumns(columnIds: string[]): Promise<CardRow[]> {
    return getProjectsRepo().listCardsForColumns(columnIds)
}

export async function listCardsForBoard(boardId: string): Promise<CardRow[]> {
    return getProjectsRepo().listCardsForBoard(boardId)
}

export async function getCardById(cardId: string): Promise<CardRow | null> {
    return getProjectsRepo().getCardById(cardId)
}

export async function insertCard(values: CardInsert): Promise<void> {
    return getProjectsRepo().insertCard(values)
}

export async function updateCard(cardId: string, patch: CardUpdate): Promise<void> {
    return getProjectsRepo().updateCard(cardId, patch)
}

export async function deleteCard(cardId: string): Promise<void> {
    return getProjectsRepo().deleteCard(cardId)
}

export async function getMaxCardOrder(columnId: string): Promise<number> {
    return getProjectsRepo().getMaxCardOrder(columnId)
}

export async function listCardsWithColumn(boardId: string): Promise<CardWithColumnBoard[]> {
    return getProjectsRepo().listCardsWithColumn(boardId)
}
