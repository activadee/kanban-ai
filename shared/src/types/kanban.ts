import type {ConversationItem} from './conversation'
import type {DashboardOverview} from './dashboard'
import type {AttemptTodoSummary} from './attempt-todos'
import type {TicketType} from './ticket'

export type ID = string

export type ColumnId = ID
export type CardId = ID

export type ColumnKey = 'backlog' | 'inProgress' | 'review' | 'done'

export type CardEnhancementSuggestion = {
    title: string
    description?: string
}

export interface Card {
    id: CardId
    ticketKey?: string | null
    prUrl?: string | null
    ticketType?: TicketType | null
    title: string
    description?: string
    /**
     * IDs of cards this card depends on. When any dependency is not in the
     * Done column, the card is considered "blocked" and cannot be started.
     */
    dependsOn?: CardId[]
    createdAt: string
    updatedAt: string
}

export interface Column {
    id: ColumnId
    key?: ColumnKey
    title: string
    cardIds: CardId[]
}

export interface BoardState {
    columns: Record<ColumnId, Column>
    columnOrder: ColumnId[]
    cards: Record<CardId, Card>
}

// WebSocket message envelope
export type WsMsg =
    | { type: 'hello'; payload: { serverTime: string } }
    | { type: 'state'; payload: BoardState }
    | { type: 'get_state' }
    | { type: 'ping'; payload?: { ts?: string } }
    | { type: 'pong'; payload?: { ts?: string } }
    | { type: 'create_card'; payload: { columnId: ColumnId; title: string; description?: string; ticketType?: TicketType | null } }
    | { type: 'move_card'; payload: { cardId: CardId; toColumnId: ColumnId; toIndex: number } }
    | { type: 'update_card'; payload: { cardId: CardId; title?: string; description?: string; ticketType?: TicketType | null } }
    | { type: 'delete_card'; payload: { cardId: CardId } }
    // Attempt event envelopes broadcast by server; client may ignore until UI lands
    | { type: 'attempt_started'; payload: { attemptId: string; cardId: string } }
    | { type: 'attempt_status'; payload: { attemptId: string; status: import('./runner').AttemptStatus } }
    | {
    type: 'attempt_log';
    payload: { attemptId: string; level: 'info' | 'warn' | 'error'; message: string; ts: string }
}
    | { type: 'conversation_item'; payload: { attemptId: string; item: ConversationItem } }
    | { type: 'attempt_session'; payload: { attemptId: string; sessionId: string } }
    | { type: 'attempt_todos'; payload: { attemptId: string; todos: AttemptTodoSummary } }
    | { type: 'git:status' }
    | { type: 'git_commit'; payload: { attemptId: string; shortSha: string; subject: string; ts: string } }
    | { type: 'git_push'; payload: { attemptId: string; remote: string; branch: string; ts: string } }
    | { type: 'attempt_pr'; payload: { attemptId: string; pr: import('./git').PRInfo } }
    | {
    type: 'agent_profile'
    payload: {
        kind: 'created' | 'updated' | 'deleted'
        profileId: string
        agent: string
        label?: string | null
    }
}
    | {
    type: 'agent_registered'
    payload: {
        agent: string
        label?: string | null
    }
}
    | {
    type: 'dashboard_overview'
    payload: DashboardOverview
}

export const initialBoard = (): BoardState => {
    const now = new Date().toISOString()
    const mkId = (p: string, i: number) => `${p}-${i}`

    const colBacklog: Column = {id: 'col-backlog', key: 'backlog', title: 'Backlog', cardIds: []}
    const colInProg: Column = {id: 'col-inprogress', key: 'inProgress', title: 'In Progress', cardIds: []}
    const colReview: Column = {id: 'col-review', key: 'review', title: 'Review', cardIds: []}
    const colDone: Column = {id: 'col-done', key: 'done', title: 'Done', cardIds: []}

    const c1: Card = {
        id: mkId('card', 1),
        title: 'Set up project',
        description: 'Bootstrap bhvr monorepo',
        createdAt: now,
        updatedAt: now
    }
    const c2: Card = {
        id: mkId('card', 2),
        title: 'Add shadcn UI',
        description: 'Buttons, cards, dialogs',
        createdAt: now,
        updatedAt: now
    }
    const c3: Card = {
        id: mkId('card', 3),
        title: 'Wire WebSockets',
        description: 'Realtime board sync',
        createdAt: now,
        updatedAt: now
    }

    colBacklog.cardIds.push(c2.id)
    colInProg.cardIds.push(c1.id)
    colReview.cardIds.push(c3.id)

    return {
        columns: {
            [colBacklog.id]: colBacklog,
            [colInProg.id]: colInProg,
            [colReview.id]: colReview,
            [colDone.id]: colDone,
        },
        columnOrder: [colBacklog.id, colInProg.id, colReview.id, colDone.id],
        cards: {
            [c1.id]: c1,
            [c2.id]: c2,
            [c3.id]: c3,
        },
    }
}
