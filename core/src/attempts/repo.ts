import {getAttemptsRepo} from '../repos/provider'
import type {
    AttemptRow,
    AttemptInsert,
    AttemptLogRow,
    AttemptLogInsert,
    ConversationItemRow,
    ConversationItemInsert,
    AttemptTodoRow,
} from '../db/types'
import type {AttemptUpdate} from '../repos/interfaces'

export type {AttemptInsert, AttemptUpdate, AttemptLogInsert, ConversationItemInsert}
export type AttemptTodoInsert = {attemptId: string; todosJson: string}

export async function getAttemptById(id: string): Promise<AttemptRow | null> {
    return getAttemptsRepo().getAttemptById(id)
}

export async function getAttemptForCard(boardId: string, cardId: string): Promise<AttemptRow | null> {
    return getAttemptsRepo().getAttemptForCard(boardId, cardId)
}

export async function insertAttempt(values: AttemptInsert): Promise<void> {
    return getAttemptsRepo().insertAttempt(values)
}

export async function updateAttempt(id: string, patch: AttemptUpdate): Promise<void> {
    return getAttemptsRepo().updateAttempt(id, patch)
}

export async function listAttemptLogs(attemptId: string): Promise<AttemptLogRow[]> {
    return getAttemptsRepo().listAttemptLogs(attemptId)
}

export async function insertAttemptLog(values: AttemptLogInsert): Promise<void> {
    return getAttemptsRepo().insertAttemptLog(values)
}

export async function listConversationItems(attemptId: string): Promise<ConversationItemRow[]> {
    return getAttemptsRepo().listConversationItems(attemptId)
}

export async function listConversationItemsDescending(
    attemptId: string,
    limit: number,
): Promise<Array<{itemJson: string}>> {
    return getAttemptsRepo().listConversationItemsDescending(attemptId, limit)
}

export async function insertConversationItem(values: ConversationItemInsert): Promise<void> {
    return getAttemptsRepo().insertConversationItem(values)
}

export async function getNextConversationSeq(attemptId: string): Promise<number> {
    return getAttemptsRepo().getNextConversationSeq(attemptId)
}

export async function getAttemptBoardId(attemptId: string): Promise<string | null> {
    return getAttemptsRepo().getAttemptBoardId(attemptId)
}

export async function listAttemptsForBoard(boardId: string): Promise<AttemptRow[]> {
    return getAttemptsRepo().listAttemptsForBoard(boardId)
}

export async function upsertAttemptTodos(attemptId: string, todosJson: string): Promise<void> {
    return getAttemptsRepo().upsertAttemptTodos(attemptId, todosJson)
}

export async function getAttemptTodos(attemptId: string): Promise<AttemptTodoRow | null> {
    return getAttemptsRepo().getAttemptTodos(attemptId)
}
