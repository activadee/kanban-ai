import type {BoardState} from 'shared'

export interface BoardStateChangedEvent {
    boardId: string
    state: BoardState
    reason?: string
}

export interface CardCreatedEvent {
    boardId: string
    columnId: string
    cardId: string
}

export interface CardUpdatedEvent {
    boardId: string
    cardId: string
    changes: Partial<{ title: string; description: string | null; ticketKey: string | null }>
}

export interface CardMovedEvent {
    boardId: string
    cardId: string
    fromColumnId: string
    toColumnId: string
    toIndex: number
}

export interface CardDeletedEvent {
    boardId: string
    cardId: string
    columnId: string
}

export interface BoardColumnsInitializedEvent {
    boardId: string
    columnIds: string[]
}

export type TaskEventMap = {
    'board.state.changed': BoardStateChangedEvent
    'board.columns.initialized': BoardColumnsInitializedEvent
    'card.created': CardCreatedEvent
    'card.updated': CardUpdatedEvent
    'card.moved': CardMovedEvent
    'card.deleted': CardDeletedEvent
}
