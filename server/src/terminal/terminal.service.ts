import {spawn, type IPty} from '@zenyr/bun-pty'
import type {ServerWebSocket} from 'bun'
import type {TerminalInfo, TerminalCloseReason} from 'shared'
import {log} from '../log'

/**
 * Detect the default shell based on platform and environment.
 * - Windows: PowerShell > COMSPEC (cmd.exe) > powershell.exe fallback
 * - Unix: SHELL env > bash fallback
 */
export function getDefaultShell(): string {
    const isWindows = process.platform === 'win32'

    if (isWindows) {
        const comspecIncludesPowershell = process.env.COMSPEC?.toLowerCase().includes('powershell')
        return comspecIncludesPowershell ? process.env.COMSPEC! : 'powershell.exe'
    }

    return process.env.SHELL || 'bash'
}

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

        const pty = spawn(shell, [], {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: worktreePath,
            env: {...process.env, TERM: 'xterm-256color'},
        })

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
            } catch {
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
