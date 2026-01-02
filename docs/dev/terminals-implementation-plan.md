# Terminals Feature Implementation Plan

> **Deprecated**: This planning document contains outdated information.
> See [terminals-feature.md](./terminals-feature.md) for the actual implementation details.

## Overview

A "Terminals" tool for KanbanAI that opens PTY terminals in git worktree directories for cards in "In Progress" or "Review" columns.

### Key Requirements
- Shows in the tool sidebar (per-project)
- Lists cards with worktrees in eligible columns
- Opens PTY terminals in card's worktree directory
- One terminal per card (simple model)
- WebSocket for bidirectional terminal I/O
- Auto-destroys terminal when card moves out or all clients disconnect
- Uses `bun-pty` for cross-platform PTY support

---

## Phase 1: Backend Foundation

### 1.1 Add Dependencies

**File: `server/package.json`**
```json
{
  "dependencies": {
    "bun-pty": "^0.3.0"
  }
}
```

**Task:** Run `bun add bun-pty` in the `server/` workspace.

---

### 1.2 Create Shared Types

**File: `shared/src/types/terminal.ts`**
```typescript
/** Terminal session info for API responses */
export interface TerminalInfo {
  cardId: string
  worktreePath: string
  connected: boolean
  clientCount: number
}

/** WebSocket message types (client → server) */
export type TerminalClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }

/** WebSocket message types (server → client) */
export type TerminalServerMessage =
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number; signal?: string }
  | { type: 'error'; message: string }

/** Card with terminal eligibility info */
export interface TerminalEligibleCard {
  id: string
  title: string
  ticketKey: string | null
  columnTitle: string
  worktreePath: string
  hasActiveTerminal: boolean
}
```

**Task:** Export from `shared/src/types/index.ts`:
```typescript
export * from './terminal'
```

---

### 1.3 Create Terminal Event Types

**File: `server/src/events/types/terminal-events.ts`**
```typescript
export interface TerminalSpawnedEvent {
  cardId: string
  boardId: string
  worktreePath: string
}

export interface TerminalDestroyedEvent {
  cardId: string
  boardId: string
  reason: 'disconnect' | 'card_moved' | 'manual' | 'exit'
}

export interface TerminalOutputEvent {
  cardId: string
  boardId: string
  /** Truncated preview for logging (not full output) */
  preview: string
}

export type TerminalEventMap = {
  'terminal.spawned': TerminalSpawnedEvent
  'terminal.destroyed': TerminalDestroyedEvent
  'terminal.output': TerminalOutputEvent
}
```

**Task:** Update `server/src/events/index.ts`:
```typescript
import type { TerminalEventMap } from './types/terminal-events'

export type AppEventMap = ProjectEventMap &
    TaskEventMap &
    AttemptEventMap &
    GitEventMap &
    SettingsEventMap &
    EditorEventMap &
    AgentEventMap &
    DashboardEventMap &
    TerminalEventMap  // Add this

// Add export
export * from './types/terminal-events'
```

---

### 1.4 Create Terminal Service

**File: `server/src/terminals/service.ts`**

```typescript
import { spawn, type IPty } from 'bun-pty'
import type { AppEventBus } from '../events/bus'
import type { WSContext } from 'hono/ws'
import { attempts as attemptsService, projectsRepo } from 'core'
import { existsSync } from 'node:fs'
import { log } from '../log'

interface TerminalEntry {
  pty: IPty
  clients: Set<WSContext>
  cardId: string
  boardId: string
  worktreePath: string
  dataDisposable: { dispose: () => void }
  exitDisposable: { dispose: () => void }
}

// Runtime-only state (no database)
const terminals = new Map<string, TerminalEntry>()
let terminalEvents: AppEventBus | null = null

/**
 * Bind the terminal service to the event bus.
 * Called during app startup from registerEventListeners.
 */
export function bindTerminalEventBus(bus: AppEventBus) {
  terminalEvents = bus

  // Listen for card movements to cleanup terminals
  bus.subscribe('card.moved', async ({ cardId, toColumnId }) => {
    try {
      const toColumn = await projectsRepo.getColumnById(toColumnId)
      const toTitle = (toColumn?.title || '').trim().toLowerCase()

      // Destroy terminal when card leaves "In Progress" or "Review"
      if (toTitle !== 'in progress' && toTitle !== 'review') {
        await destroyTerminal(cardId, 'card_moved')
      }
    } catch (err) {
      log.error('terminals', 'Error handling card.moved event', { cardId, err })
    }
  })
}

/**
 * Get worktree path for a card by finding the most recent attempt with a valid worktree.
 */
export async function getWorktreePathForCard(cardId: string): Promise<{ path: string; boardId: string } | null> {
  try {
    const card = await projectsRepo.getCardById(cardId)
    if (!card) return null

    const boardId = card.boardId
    const attempts = await attemptsService.listAttemptsForCard(boardId, cardId)

    // Find the most recent attempt with a valid worktree path
    for (const attempt of attempts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )) {
      if (attempt.worktreePath && existsSync(attempt.worktreePath)) {
        return { path: attempt.worktreePath, boardId }
      }
    }

    return null
  } catch (err) {
    log.error('terminals', 'Error getting worktree path', { cardId, err })
    return null
  }
}

/**
 * Connect a WebSocket client to a terminal.
 * Spawns PTY lazily on first connection.
 */
export async function connectTerminal(cardId: string, ws: WSContext): Promise<boolean> {
  let entry = terminals.get(cardId)

  if (!entry) {
    // Lazy spawn on first connect
    const worktreeInfo = await getWorktreePathForCard(cardId)
    if (!worktreeInfo) {
      log.warn('terminals', 'No valid worktree for card', { cardId })
      return false
    }

    const { path: worktreePath, boardId } = worktreeInfo
    const shell = process.env.SHELL || 'bash'

    try {
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: worktreePath,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          KANBANAI_CARD_ID: cardId,
        },
      })

      entry = {
        pty,
        clients: new Set(),
        cardId,
        boardId,
        worktreePath,
        dataDisposable: { dispose: () => {} },
        exitDisposable: { dispose: () => {} },
      }

      // Handle PTY output
      entry.dataDisposable = pty.onData((data: string) => {
        const message = JSON.stringify({ type: 'output', data })
        entry!.clients.forEach(client => {
          try {
            client.send(message)
          } catch {
            // Client may have disconnected
          }
        })
      })

      // Handle PTY exit
      entry.exitDisposable = pty.onExit(({ exitCode, signal }) => {
        const message = JSON.stringify({ type: 'exit', code: exitCode, signal })
        entry!.clients.forEach(client => {
          try {
            client.send(message)
          } catch {
            // Client may have disconnected
          }
        })
        destroyTerminal(cardId, 'exit')
      })

      terminals.set(cardId, entry)
      log.info('terminals', 'PTY spawned', { cardId, worktreePath, pid: pty.pid })

      terminalEvents?.publish('terminal.spawned', {
        cardId,
        boardId,
        worktreePath,
      })
    } catch (err) {
      log.error('terminals', 'Failed to spawn PTY', { cardId, err })
      return false
    }
  }

  entry.clients.add(ws)
  log.info('terminals', 'Client connected', { cardId, clientCount: entry.clients.size })
  return true
}

/**
 * Disconnect a WebSocket client from a terminal.
 * Destroys PTY when last client disconnects.
 */
export function disconnectTerminal(cardId: string, ws: WSContext): void {
  const entry = terminals.get(cardId)
  if (!entry) return

  entry.clients.delete(ws)
  log.info('terminals', 'Client disconnected', { cardId, clientCount: entry.clients.size })

  // Destroy PTY when last client disconnects
  if (entry.clients.size === 0) {
    destroyTerminal(cardId, 'disconnect')
  }
}

/**
 * Write data to a terminal.
 */
export function writeTerminal(cardId: string, data: string): boolean {
  const entry = terminals.get(cardId)
  if (!entry) return false

  try {
    entry.pty.write(data)
    return true
  } catch (err) {
    log.error('terminals', 'Failed to write to PTY', { cardId, err })
    return false
  }
}

/**
 * Resize a terminal.
 */
export function resizeTerminal(cardId: string, cols: number, rows: number): boolean {
  const entry = terminals.get(cardId)
  if (!entry) return false

  try {
    entry.pty.resize(cols, rows)
    return true
  } catch (err) {
    log.error('terminals', 'Failed to resize PTY', { cardId, err })
    return false
  }
}

/**
 * Destroy a terminal and clean up resources.
 */
export async function destroyTerminal(
  cardId: string,
  reason: 'disconnect' | 'card_moved' | 'manual' | 'exit'
): Promise<void> {
  const entry = terminals.get(cardId)
  if (!entry) return

  log.info('terminals', 'Destroying terminal', { cardId, reason })

  // Close all client connections
  entry.clients.forEach(client => {
    try {
      client.close(1000, `Terminal closed: ${reason}`)
    } catch {
      // Client may already be closed
    }
  })
  entry.clients.clear()

  // Cleanup event handlers
  entry.dataDisposable.dispose()
  entry.exitDisposable.dispose()

  // Kill PTY if not already exited
  if (reason !== 'exit') {
    try {
      entry.pty.kill('SIGTERM')
      // Fallback to SIGKILL after 2 seconds
      setTimeout(() => {
        try {
          entry.pty.kill('SIGKILL')
        } catch {
          // Process may have already exited
        }
      }, 2000)
    } catch {
      // PTY may have already exited
    }
  }

  terminals.delete(cardId)

  terminalEvents?.publish('terminal.destroyed', {
    cardId,
    boardId: entry.boardId,
    reason,
  })
}

/**
 * Get info about a specific terminal.
 */
export function getTerminalInfo(cardId: string): { connected: boolean; clientCount: number } | null {
  const entry = terminals.get(cardId)
  if (!entry) return null

  return {
    connected: true,
    clientCount: entry.clients.size,
  }
}

/**
 * Get all active terminal card IDs.
 */
export function getActiveTerminalCardIds(): string[] {
  return Array.from(terminals.keys())
}

/**
 * Cleanup all terminals (for graceful shutdown).
 */
export async function cleanupAllTerminals(): Promise<void> {
  const cardIds = Array.from(terminals.keys())
  await Promise.all(cardIds.map(id => destroyTerminal(id, 'manual')))
}
```

---

### 1.5 Create Terminal Schemas

**File: `server/src/terminals/schemas.ts`**
```typescript
import { z } from 'zod'

export const terminalCardIdParam = z.object({
  cardId: z.string().min(1),
})

export const terminalProjectIdParam = z.object({
  projectId: z.string().min(1),
})

// WebSocket message validation
export const terminalInputMessage = z.object({
  type: z.literal('input'),
  data: z.string(),
})

export const terminalResizeMessage = z.object({
  type: z.literal('resize'),
  cols: z.number().int().min(1).max(500),
  rows: z.number().int().min(1).max(200),
})

export const terminalClientMessage = z.discriminatedUnion('type', [
  terminalInputMessage,
  terminalResizeMessage,
])
```

---

### 1.6 Create Terminal HTTP Handlers

**File: `server/src/terminals/handlers.ts`**
```typescript
import { zValidator } from '@hono/zod-validator'
import { projectsRepo, attempts } from 'core'
import { existsSync } from 'node:fs'
import type { TerminalEligibleCard } from 'shared'
import { createHandlers } from '../lib/factory'
import { problemJson } from '../http/problem'
import { terminalProjectIdParam, terminalCardIdParam } from './schemas'
import { getTerminalInfo, getWorktreePathForCard, destroyTerminal } from './service'

/**
 * List cards eligible for terminal access in a project.
 * Returns cards in "In Progress" or "Review" columns with valid worktrees.
 */
export const listEligibleCardsHandlers = createHandlers(
  zValidator('param', terminalProjectIdParam),
  async (c) => {
    const { projectId } = c.req.valid('param')

    // Get project's board
    const project = await projectsRepo.getProjectById(projectId)
    if (!project) {
      return problemJson(c, { status: 404, detail: 'Project not found' })
    }

    const boardState = await projectsRepo.getBoardState(project.boardId)
    if (!boardState) {
      return problemJson(c, { status: 404, detail: 'Board not found' })
    }

    // Find "In Progress" and "Review" columns
    const eligibleColumns = boardState.columns.filter(col => {
      const title = col.title.toLowerCase().trim()
      return title === 'in progress' || title === 'review'
    })

    // Collect cards with worktrees
    const eligibleCards: TerminalEligibleCard[] = []

    for (const column of eligibleColumns) {
      for (const card of column.cards) {
        // Get worktree path for card
        const worktreeInfo = await getWorktreePathForCard(card.id)
        if (worktreeInfo) {
          const terminalInfo = getTerminalInfo(card.id)
          eligibleCards.push({
            id: card.id,
            title: card.title,
            ticketKey: card.ticketKey ?? null,
            columnTitle: column.title,
            worktreePath: worktreeInfo.path,
            hasActiveTerminal: terminalInfo?.connected ?? false,
          })
        }
      }
    }

    return c.json({ cards: eligibleCards })
  }
)

/**
 * Get terminal info for a specific card.
 */
export const getTerminalInfoHandlers = createHandlers(
  zValidator('param', terminalCardIdParam),
  async (c) => {
    const { cardId } = c.req.valid('param')

    const card = await projectsRepo.getCardById(cardId)
    if (!card) {
      return problemJson(c, { status: 404, detail: 'Card not found' })
    }

    const worktreeInfo = await getWorktreePathForCard(cardId)
    if (!worktreeInfo) {
      return problemJson(c, { status: 404, detail: 'No worktree available for this card' })
    }

    const terminalInfo = getTerminalInfo(cardId)

    return c.json({
      cardId,
      worktreePath: worktreeInfo.path,
      connected: terminalInfo?.connected ?? false,
      clientCount: terminalInfo?.clientCount ?? 0,
    })
  }
)

/**
 * Force destroy a terminal (admin action).
 */
export const destroyTerminalHandlers = createHandlers(
  zValidator('param', terminalCardIdParam),
  async (c) => {
    const { cardId } = c.req.valid('param')

    const terminalInfo = getTerminalInfo(cardId)
    if (!terminalInfo) {
      return problemJson(c, { status: 404, detail: 'No active terminal for this card' })
    }

    await destroyTerminal(cardId, 'manual')
    return c.json({ ok: true, message: 'Terminal destroyed' })
  }
)
```

---

### 1.7 Create Terminal WebSocket Handler

**File: `server/src/terminals/websocket.ts`**
```typescript
import { createBunWebSocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import type { AppEnv } from '../env'
import { log } from '../log'
import {
  connectTerminal,
  disconnectTerminal,
  writeTerminal,
  resizeTerminal,
} from './service'
import { terminalClientMessage } from './schemas'

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

export { websocket }

interface WSData {
  cardId: string
}

export const terminalWebSocketHandler = upgradeWebSocket<AppEnv>((c) => {
  const cardId = c.req.param('cardId')

  if (!cardId) {
    return {
      onOpen(event, ws) {
        ws.close(4400, 'Missing cardId parameter')
      },
    }
  }

  return {
    async onOpen(event, ws) {
      const success = await connectTerminal(cardId, ws)
      if (!success) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to connect to terminal. No valid worktree available.',
        }))
        ws.close(4404, 'No worktree available')
      }
    },

    onMessage(event, ws) {
      try {
        const raw = typeof event.data === 'string' 
          ? event.data 
          : new TextDecoder().decode(event.data as ArrayBuffer)

        const parsed = JSON.parse(raw)
        const result = terminalClientMessage.safeParse(parsed)

        if (!result.success) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }))
          return
        }

        const msg = result.data

        switch (msg.type) {
          case 'input':
            writeTerminal(cardId, msg.data)
            break
          case 'resize':
            resizeTerminal(cardId, msg.cols, msg.rows)
            break
        }
      } catch (err) {
        log.error('terminals:ws', 'Error processing message', { cardId, err })
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
        }))
      }
    },

    onClose(event, ws) {
      disconnectTerminal(cardId, ws)
    },

    onError(event, ws) {
      log.error('terminals:ws', 'WebSocket error', { cardId })
      disconnectTerminal(cardId, ws)
    },
  }
})
```

---

### 1.8 Create Terminal Routes

**File: `server/src/terminals/routes.ts`**
```typescript
import { Hono } from 'hono'
import type { AppEnv } from '../env'
import {
  listEligibleCardsHandlers,
  getTerminalInfoHandlers,
  destroyTerminalHandlers,
} from './handlers'

export const createTerminalsRouter = () =>
  new Hono<AppEnv>()
    .get('/projects/:projectId/terminals', ...listEligibleCardsHandlers)
    .get('/cards/:cardId/terminal', ...getTerminalInfoHandlers)
    .delete('/cards/:cardId/terminal', ...destroyTerminalHandlers)

export type TerminalsRoutes = ReturnType<typeof createTerminalsRouter>
```

---

### 1.9 Register Terminal Event Listeners

**File: `server/src/terminals/listeners.ts`**
```typescript
import type { AppEventBus } from '../events/bus'
import { broadcast } from '../sse/bus'

/**
 * Register SSE listeners for terminal events.
 * Broadcasts terminal status changes to connected clients.
 */
export function registerTerminalSSEListeners(bus: AppEventBus) {
  bus.subscribe('terminal.spawned', ({ boardId, cardId }) => {
    broadcast(boardId, 'terminal_spawned', { cardId })
  })

  bus.subscribe('terminal.destroyed', ({ boardId, cardId, reason }) => {
    broadcast(boardId, 'terminal_destroyed', { cardId, reason })
  })
}
```

---

### 1.10 Mount Routes in App

**File: `server/src/app.ts`** (modifications)

```typescript
// Add imports
import { createTerminalsRouter } from './terminals/routes'
import { terminalWebSocketHandler, websocket } from './terminals/websocket'

// In createApp function:

// Mount WebSocket BEFORE REST routes (at app level, not api sub-router)
app.get('/ws/terminals/:cardId', terminalWebSocketHandler)

// Mount REST routes in api router
api.route('/terminals', createTerminalsRouter())

// Export websocket handler for Bun
// At bottom of file or in export:
export { websocket }
```

**File: `server/src/events/register.ts`** (modifications)
```typescript
// Add imports
import { bindTerminalEventBus } from '../terminals/service'
import { registerTerminalSSEListeners } from '../terminals/listeners'

// In registerEventListeners function, add:
bindTerminalEventBus(bus)
registerTerminalSSEListeners(bus)
```

---

## Phase 2: Frontend Implementation

### 2.1 Add Dependencies

**File: `client/package.json`**
```json
{
  "dependencies": {
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0"
  }
}
```

**Task:** Run `bun add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links` in the `client/` workspace.

---

### 2.2 Create Terminal API Client

**File: `client/src/api/terminals.ts`**
```typescript
import type { TerminalEligibleCard, TerminalInfo } from 'shared'
import { SERVER_URL } from '@/lib/env'
import { parseApiResponse } from '@/api/http'

export async function listEligibleCards(projectId: string): Promise<TerminalEligibleCard[]> {
  const res = await fetch(`${SERVER_URL}/terminals/projects/${projectId}/terminals`)
  const data = await parseApiResponse<{ cards: TerminalEligibleCard[] }>(res)
  return data.cards
}

export async function getTerminalInfo(cardId: string): Promise<TerminalInfo> {
  const res = await fetch(`${SERVER_URL}/terminals/cards/${cardId}/terminal`)
  return parseApiResponse<TerminalInfo>(res)
}

export async function destroyTerminal(cardId: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/terminals/cards/${cardId}/terminal`, {
    method: 'DELETE',
  })
  await parseApiResponse(res)
}

/**
 * Get WebSocket URL for terminal connection.
 */
export function getTerminalWebSocketUrl(cardId: string): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = new URL(SERVER_URL).host
  return `${wsProtocol}//${host}/ws/terminals/${cardId}`
}
```

---

### 2.3 Create Terminal React Query Hooks

**File: `client/src/hooks/useProjectTerminals.ts`**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TerminalEligibleCard } from 'shared'
import {
  listEligibleCards,
  getTerminalInfo,
  destroyTerminal as destroyTerminalApi,
} from '@/api/terminals'

export const terminalKeys = {
  all: ['terminals'] as const,
  list: (projectId: string) => [...terminalKeys.all, 'list', projectId] as const,
  info: (cardId: string) => [...terminalKeys.all, 'info', cardId] as const,
}

export function useProjectTerminals(projectId: string | undefined) {
  return useQuery({
    queryKey: terminalKeys.list(projectId!),
    queryFn: () => listEligibleCards(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: 30000, // Refresh every 30s
  })
}

export function useTerminalInfo(cardId: string | undefined) {
  return useQuery({
    queryKey: terminalKeys.info(cardId!),
    queryFn: () => getTerminalInfo(cardId!),
    enabled: Boolean(cardId),
  })
}

export function useDestroyTerminal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: destroyTerminalApi,
    onSuccess: (_, cardId) => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.info(cardId) })
      queryClient.invalidateQueries({ queryKey: terminalKeys.all })
    },
  })
}
```

---

### 2.4 Create Terminal WebSocket Hook

**File: `client/src/hooks/useTerminalWebSocket.ts`**
```typescript
import { useEffect, useRef, useCallback, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { TerminalServerMessage, TerminalClientMessage } from 'shared'
import { getTerminalWebSocketUrl } from '@/api/terminals'

export type TerminalStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseTerminalWebSocketOptions {
  cardId: string
  terminal: Terminal | null
  onStatusChange?: (status: TerminalStatus) => void
}

export function useTerminalWebSocket({
  cardId,
  terminal,
  onStatusChange,
}: UseTerminalWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<TerminalStatus>('disconnected')

  const updateStatus = useCallback((newStatus: TerminalStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // Send input to terminal
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: TerminalClientMessage = { type: 'input', data }
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Send resize to terminal
  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: TerminalClientMessage = { type: 'resize', cols, rows }
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Connect to WebSocket
  useEffect(() => {
    if (!terminal || !cardId) return

    updateStatus('connecting')
    const url = getTerminalWebSocketUrl(cardId)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      updateStatus('connected')
      // Send initial resize
      sendResize(terminal.cols, terminal.rows)
    }

    ws.onmessage = (event) => {
      try {
        const msg: TerminalServerMessage = JSON.parse(event.data)
        switch (msg.type) {
          case 'output':
            terminal.write(msg.data)
            break
          case 'exit':
            terminal.write(`\r\n[Process exited with code ${msg.code}]\r\n`)
            updateStatus('disconnected')
            break
          case 'error':
            terminal.write(`\r\n[Error: ${msg.message}]\r\n`)
            break
        }
      } catch {
        // Invalid message format
      }
    }

    ws.onclose = () => {
      updateStatus('disconnected')
    }

    ws.onerror = () => {
      updateStatus('error')
    }

    // Handle terminal input
    const inputDisposable = terminal.onData((data) => {
      sendInput(data)
    })

    // Handle terminal resize
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      sendResize(cols, rows)
    })

    return () => {
      inputDisposable.dispose()
      resizeDisposable.dispose()
      ws.close()
      wsRef.current = null
    }
  }, [terminal, cardId, updateStatus, sendInput, sendResize])

  return {
    status,
    sendInput,
    sendResize,
  }
}
```

---

### 2.5 Create Terminal Component

**File: `client/src/components/Terminal/Terminal.tsx`**
```typescript
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export interface TerminalRef {
  terminal: XTerm | null
  fit: () => void
}

interface TerminalProps {
  className?: string
  onReady?: (terminal: XTerm) => void
}

export const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(
  function Terminal({ className, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)

    useImperativeHandle(ref, () => ({
      terminal: terminalRef.current,
      fit: () => fitAddonRef.current?.fit(),
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const terminal = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1a1b26',
          foreground: '#a9b1d6',
          cursor: '#c0caf5',
          cursorAccent: '#1a1b26',
          selectionBackground: '#33467c',
          black: '#32344a',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          blue: '#7aa2f7',
          magenta: '#ad8ee6',
          cyan: '#449dab',
          white: '#787c99',
          brightBlack: '#444b6a',
          brightRed: '#ff7a93',
          brightGreen: '#b9f27c',
          brightYellow: '#ff9e64',
          brightBlue: '#7da6ff',
          brightMagenta: '#bb9af7',
          brightCyan: '#0db9d7',
          brightWhite: '#acb0d0',
        },
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()

      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)
      terminal.open(containerRef.current)

      // Initial fit
      fitAddon.fit()

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon

      onReady?.(terminal)

      // Handle window resize
      const handleResize = () => fitAddon.fit()
      window.addEventListener('resize', handleResize)

      // ResizeObserver for container resize
      const resizeObserver = new ResizeObserver(() => fitAddon.fit())
      resizeObserver.observe(containerRef.current)

      return () => {
        window.removeEventListener('resize', handleResize)
        resizeObserver.disconnect()
        terminal.dispose()
        terminalRef.current = null
        fitAddonRef.current = null
      }
    }, [onReady])

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }
)
```

---

### 2.6 Create Terminal Panel Component

**File: `client/src/components/Terminal/TerminalPanel.tsx`**
```typescript
import { useState, useRef, useCallback } from 'react'
import { X, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import type { Terminal } from '@xterm/xterm'
import type { TerminalEligibleCard } from 'shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TerminalComponent, type TerminalRef } from './Terminal'
import { useTerminalWebSocket, type TerminalStatus } from '@/hooks/useTerminalWebSocket'

interface TerminalPanelProps {
  card: TerminalEligibleCard
  onClose: () => void
  className?: string
}

export function TerminalPanel({ card, onClose, className }: TerminalPanelProps) {
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const terminalRef = useRef<TerminalRef>(null)

  const { status } = useTerminalWebSocket({
    cardId: card.id,
    terminal,
  })

  const handleReady = useCallback((term: Terminal) => {
    setTerminal(term)
  }, [])

  const handleReconnect = useCallback(() => {
    // Force reconnect by remounting
    setTerminal(null)
    setTimeout(() => {
      terminalRef.current?.fit()
    }, 100)
  }, [])

  const statusColor: Record<TerminalStatus, string> = {
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500',
  }

  return (
    <div
      className={cn(
        'flex flex-col border rounded-lg overflow-hidden bg-[#1a1b26]',
        isMaximized && 'fixed inset-4 z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', statusColor[status])} />
          <span className="text-sm font-medium text-zinc-200">
            {card.ticketKey || card.title}
          </span>
          <span className="text-xs text-zinc-500">
            {card.columnTitle}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {status === 'disconnected' || status === 'error' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
              onClick={handleReconnect}
              title="Reconnect"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0">
        <TerminalComponent
          ref={terminalRef}
          className="h-full"
          onReady={handleReady}
        />
      </div>
    </div>
  )
}
```

---

### 2.7 Create Terminals Tool Window

**File: `client/src/components/Terminal/TerminalsToolWindow.tsx`**
```typescript
import { useState } from 'react'
import { Terminal as TerminalIcon, RefreshCw, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import type { TerminalEligibleCard } from 'shared'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useProjectTerminals, useDestroyTerminal } from '@/hooks/useProjectTerminals'
import { TerminalPanel } from './TerminalPanel'

export function TerminalsToolWindow() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: cards, isLoading, refetch } = useProjectTerminals(projectId)
  const destroyMutation = useDestroyTerminal()
  const [activeTerminal, setActiveTerminal] = useState<TerminalEligibleCard | null>(null)

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a project to view terminals
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-5 w-5" />
          <h2 className="font-semibold">Terminals</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Card List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading...
            </div>
          ) : cards?.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No terminals available</p>
              <p className="text-sm mt-1">
                Cards in "In Progress" or "Review" with worktrees will appear here
              </p>
            </div>
          ) : (
            cards?.map((card) => (
              <div
                key={card.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  'hover:bg-muted/50 cursor-pointer transition-colors',
                  activeTerminal?.id === card.id && 'bg-muted border-primary'
                )}
                onClick={() => setActiveTerminal(card)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {card.hasActiveTerminal && (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                    <span className="font-medium truncate">
                      {card.ticketKey || card.title}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {card.worktreePath}
                  </div>
                </div>
                {card.hasActiveTerminal && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 ml-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      destroyMutation.mutate(card.id)
                    }}
                    title="Kill terminal"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Terminal Panel */}
      {activeTerminal && (
        <div className="h-[400px] border-t">
          <TerminalPanel
            key={activeTerminal.id}
            card={activeTerminal}
            onClose={() => setActiveTerminal(null)}
          />
        </div>
      )}
    </div>
  )
}
```

---

### 2.8 Add Terminals to Sidebar

**File: `client/src/components/layout/AppSidebar.tsx`** (modifications)

```typescript
// Add import at top
import { Terminal } from 'lucide-react'

// In the Tools section (around line 248-270), add after "Worktrees":
<NavButton
    icon={Terminal}
    label="Terminals"
    shortcut="T"
    active={isProjectRoute('/terminals')}
    onClick={() => navigateToProjectRoute('/terminals')}
/>

// Also add in the collapsed sidebar section (around line 159-169):
<Button
    variant="ghost"
    size="icon"
    className={cn('size-8', isProjectRoute('/terminals') && 'bg-muted')}
    onClick={() => navigateToProjectRoute('/terminals')}
    title="Terminals (T)"
    aria-label="Terminals"
    disabled={!hasActiveProject}
>
    <Terminal className="size-5" />
</Button>
```

---

### 2.9 Create Terminals Page

**File: `client/src/pages/TerminalsPage.tsx`**
```typescript
import { TerminalsToolWindow } from '@/components/Terminal/TerminalsToolWindow'

export function TerminalsPage() {
  return (
    <div className="h-full">
      <TerminalsToolWindow />
    </div>
  )
}
```

---

### 2.10 Add Route

**File: `client/src/App.tsx`** (modifications)

```typescript
// Add import
import { TerminalsPage } from '@/pages/TerminalsPage'

// Add route (inside project routes, after /worktrees):
<Route path="terminals" element={<TerminalsPage />} />
```

---

### 2.11 Add Query Keys

**File: `client/src/lib/queryClient.ts`** (modifications)

```typescript
// Add terminal keys export
export const terminalKeys = {
  all: ['terminals'] as const,
  list: (projectId: string) => [...terminalKeys.all, 'list', projectId] as const,
  info: (cardId: string) => [...terminalKeys.all, 'info', cardId] as const,
}
```

---

## Phase 3: SSE Integration

### 3.1 Add Terminal SSE Event Types

**File: `client/src/lib/sse.ts`** (modifications)

Add terminal events to the event handling:

```typescript
// In the eventTypes array, add:
'terminal_spawned', 'terminal_destroyed'

// In handleMessage switch statement, add:
case 'terminal_spawned':
case 'terminal_destroyed':
  eventBus.emit(eventType, data)
  break
```

### 3.2 Handle Terminal Events in React Query

**File: `client/src/hooks/useProjectTerminals.ts`** (modifications)

```typescript
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { eventBus } from '@/lib/events'

// Add this hook to invalidate queries on SSE events
export function useTerminalSSESync(projectId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return

    const handleSpawned = () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.list(projectId) })
    }

    const handleDestroyed = () => {
      queryClient.invalidateQueries({ queryKey: terminalKeys.list(projectId) })
    }

    eventBus.on('terminal_spawned', handleSpawned)
    eventBus.on('terminal_destroyed', handleDestroyed)

    return () => {
      eventBus.off('terminal_spawned', handleSpawned)
      eventBus.off('terminal_destroyed', handleDestroyed)
    }
  }, [projectId, queryClient])
}
```

---

## Phase 4: Testing & Polish

### 4.1 Backend Tests

**File: `server/test/terminals.service.test.ts`**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  connectTerminal,
  disconnectTerminal,
  writeTerminal,
  resizeTerminal,
  getTerminalInfo,
  cleanupAllTerminals,
} from '../src/terminals/service'

describe('terminals/service', () => {
  afterEach(async () => {
    await cleanupAllTerminals()
  })

  describe('getTerminalInfo', () => {
    it('returns null for non-existent terminal', () => {
      expect(getTerminalInfo('nonexistent')).toBeNull()
    })
  })

  // Add more tests for:
  // - connectTerminal with valid worktree
  // - connectTerminal without worktree
  // - disconnectTerminal cleanup
  // - writeTerminal
  // - resizeTerminal
})
```

### 4.2 Client Tests

**File: `client/test/Terminal.test.tsx`**
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TerminalComponent } from '../src/components/Terminal/Terminal'

describe('Terminal', () => {
  it('renders terminal container', () => {
    const { container } = render(<TerminalComponent />)
    expect(container.firstChild).toBeDefined()
  })
})
```

---

## Phase 5: Documentation

### 5.1 Update AGENTS.md

Add terminal-related commands and notes.

### 5.2 Add User Documentation

**File: `docs/core/terminals.md`**
```markdown
# Terminals

KanbanAI includes a built-in terminal feature that lets you access
shell sessions directly in your card's worktree directory.

## Requirements

- Card must be in "In Progress" or "Review" column
- Card must have at least one attempt with a valid worktree

## Usage

1. Navigate to **Tools > Terminals** in the sidebar
2. Select a card from the list
3. The terminal opens in the card's worktree directory

## Features

- **Auto-cleanup**: Terminals are destroyed when cards move to Done
- **Multi-tab support**: Open the same terminal in multiple browser tabs
- **Resize support**: Terminal automatically resizes to fit the panel
```

---

## Summary Checklist

### Backend (server/)
- [ ] Add `bun-pty` dependency
- [ ] Create `shared/src/types/terminal.ts`
- [ ] Create `server/src/events/types/terminal-events.ts`
- [ ] Update `server/src/events/index.ts`
- [ ] Create `server/src/terminals/service.ts`
- [ ] Create `server/src/terminals/schemas.ts`
- [ ] Create `server/src/terminals/handlers.ts`
- [ ] Create `server/src/terminals/websocket.ts`
- [ ] Create `server/src/terminals/routes.ts`
- [ ] Create `server/src/terminals/listeners.ts`
- [ ] Update `server/src/app.ts` (mount routes + websocket)
- [ ] Update `server/src/events/register.ts`

### Frontend (client/)
- [ ] Add xterm.js dependencies
- [ ] Create `client/src/api/terminals.ts`
- [ ] Create `client/src/hooks/useProjectTerminals.ts`
- [ ] Create `client/src/hooks/useTerminalWebSocket.ts`
- [ ] Create `client/src/components/Terminal/Terminal.tsx`
- [ ] Create `client/src/components/Terminal/TerminalPanel.tsx`
- [ ] Create `client/src/components/Terminal/TerminalsToolWindow.tsx`
- [ ] Create `client/src/pages/TerminalsPage.tsx`
- [ ] Update `client/src/components/layout/AppSidebar.tsx`
- [ ] Update `client/src/App.tsx` (add route)
- [ ] Update `client/src/lib/queryClient.ts` (add keys)
- [ ] Update `client/src/lib/sse.ts` (handle events)

### Testing
- [ ] Backend service tests
- [ ] Frontend component tests

### Documentation
- [ ] Update AGENTS.md
- [ ] Create user documentation
