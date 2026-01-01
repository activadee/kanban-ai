import type {ConversationItem, AttemptTodoSummary} from 'shared'

type Handler<T> = (payload: T) => void

type Events = {
    attempt_started: { attemptId: string; cardId: string }
    attempt_status: { attemptId: string; cardId?: string; status: string }
    attempt_log: { attemptId: string; level: 'info' | 'warn' | 'error'; message: string; ts: string }
    conversation_item: { attemptId: string; item: ConversationItem }
    attempt_session: { attemptId: string; sessionId: string }
    attempt_todos: { attemptId: string; todos: AttemptTodoSummary }
    git_status: null
    git_commit: { attemptId: string; shortSha: string; subject: string; ts: string }
    git_push: { attemptId: string; remote: string; branch: string; ts: string }
    attempt_pr: { attemptId: string; pr: import('shared').PRInfo }
    agent_profile: { kind: 'created' | 'updated' | 'deleted'; profileId: string; agent: string; label?: string | null }
    agent_registered: { agent: string; label?: string | null }
    dashboard_overview: import('shared').DashboardOverview
}

class EventBus {
    private map: Partial<Record<keyof Events, Set<Handler<Events[keyof Events]>>>> = {}

    on<K extends keyof Events>(type: K, handler: Handler<Events[K]>) {
        let set = this.map[type] as Set<Handler<Events[K]>> | undefined
        if (!set) {
            set = new Set<Handler<Events[K]>>()
            this.map[type] = set as Set<Handler<Events[keyof Events]>>
        }
        set.add(handler)
        return () => this.off(type, handler)
    }

    off<K extends keyof Events>(type: K, handler: Handler<Events[K]>) {
        const set = this.map[type] as Set<Handler<Events[K]>> | undefined
        set?.delete(handler)
        if (set && set.size === 0) delete this.map[type]
    }

    emit<K extends keyof Events>(type: K, payload: Events[K]) {
        const set = this.map[type] as Set<Handler<Events[K]>> | undefined
        if (!set) return
        set.forEach((cb) => {
            try {
                cb(payload)
            } catch (error) {
                console.error('[eventBus] handler failed', error)
            }
        })
    }
}

export const eventBus = new EventBus()
