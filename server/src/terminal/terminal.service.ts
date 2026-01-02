import {spawn, type IPty} from '@zenyr/bun-pty'
import type {ServerWebSocket} from 'bun'
import type {TerminalInfo, TerminalCloseReason} from 'shared'
import {log} from '../log'
import {getDefaultShell} from './shell'

export {getDefaultShell}

interface TerminalSession {
    cardId: string
    projectId: string
    attemptId: string
    worktreePath: string
    pty: IPty
    clients: Set<ServerWebSocket<unknown>>
    cols: number
    rows: number
    shell: string
    createdAt: Date
}

class TerminalService {
    private sessions = new Map<string, TerminalSession>()

    createSession(params: {
        cardId: string
        projectId: string
        attemptId: string
        worktreePath: string
        cols?: number
        rows?: number
    }): TerminalSession {
        const {cardId, projectId, attemptId, worktreePath, cols = 80, rows = 24} = params

        if (this.sessions.has(cardId)) {
            throw new Error(`Terminal session already exists for card ${cardId}`)
        }

        const shell = getDefaultShell()

        let pty: IPty
        try {
            pty = spawn(shell, [], {
                name: 'xterm-256color',
                cols,
                rows,
                cwd: worktreePath,
                env: {...process.env, TERM: 'xterm-256color'},
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            log.error('terminal', 'failed to spawn pty', {cardId, shell, worktreePath, err})

            if (message.includes('ENOENT') || message.toLowerCase().includes('not found')) {
                throw new Error(`Shell not found: ${shell}. Please ensure the shell is installed.`)
            }
            if (message.includes('EACCES') || message.toLowerCase().includes('permission')) {
                throw new Error(`Permission denied for shell: ${shell}`)
            }
            if (message.includes('ENOTDIR') || message.toLowerCase().includes('not a directory')) {
                throw new Error(`Invalid working directory: ${worktreePath}`)
            }
            throw new Error(`Failed to spawn terminal: ${message}`)
        }

        const session: TerminalSession = {
            cardId,
            projectId,
            attemptId,
            worktreePath,
            pty,
            clients: new Set(),
            cols,
            rows,
            shell,
            createdAt: new Date(),
        }

        this.sessions.set(cardId, session)
        log.info('terminal', 'session created', {cardId, worktreePath})

        return session
    }

    getSession(cardId: string): TerminalSession | undefined {
        return this.sessions.get(cardId)
    }

    addClient(cardId: string, ws: ServerWebSocket<unknown>): void {
        const session = this.sessions.get(cardId)
        if (session) {
            session.clients.add(ws)
        }
    }

    removeClient(cardId: string, ws: ServerWebSocket<unknown>): boolean {
        const session = this.sessions.get(cardId)
        if (!session) return false

        session.clients.delete(ws)

        if (session.clients.size === 0) {
            this.destroySession(cardId, 'disconnect')
            return true
        }
        return false
    }

    write(cardId: string, data: string): void {
        const session = this.sessions.get(cardId)
        if (session) {
            session.pty.write(data)
        }
    }

    resize(cardId: string, cols: number, rows: number): void {
        const session = this.sessions.get(cardId)
        if (session) {
            session.pty.resize(cols, rows)
            session.cols = cols
            session.rows = rows
        }
    }

    destroySession(cardId: string, reason: TerminalCloseReason): void {
        const session = this.sessions.get(cardId)
        if (!session) return

        try {
            session.pty.kill()
        } catch (err) {
            log.warn('terminal', 'error killing pty', {cardId, err})
        }

        for (const ws of session.clients) {
            try {
                ws.close(1000, `Terminal closed: ${reason}`)
            } catch (err) {
                log.warn('terminal', 'failed to close WebSocket', {cardId, err})
            }
        }

        this.sessions.delete(cardId)
        log.info('terminal', 'session destroyed', {cardId, reason})
    }

    destroyAllForProject(projectId: string): void {
        for (const [cardId, session] of this.sessions) {
            if (session.projectId === projectId) {
                this.destroySession(cardId, 'project_deleted')
            }
        }
    }

    listSessionsForProject(projectId: string): TerminalInfo[] {
        const results: TerminalInfo[] = []
        for (const session of this.sessions.values()) {
            if (session.projectId === projectId) {
                results.push({
                    id: session.cardId,
                    cardId: session.cardId,
                    projectId: session.projectId,
                    attemptId: session.attemptId,
                    worktreePath: session.worktreePath,
                    cols: session.cols,
                    rows: session.rows,
                    shell: session.shell,
                    createdAt: session.createdAt.toISOString(),
                    clientCount: session.clients.size,
                })
            }
        }
        return results
    }

    hasSession(cardId: string): boolean {
        return this.sessions.has(cardId)
    }

    getAllSessions(): TerminalSession[] {
        return Array.from(this.sessions.values())
    }
}

export const terminalService = new TerminalService()
