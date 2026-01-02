# Terminals Feature - Implementation Plan

> **Status**: In Progress  
> **Branch**: `feature/terminals-tool`  
> **Created**: 2026-01-02

## Overview

The **Terminals** tool provides PTY terminal access to cards in "In Progress" or "Review" columns, opening in their worktree directories. It is per-project scoped and automatically manages terminal lifecycle based on card state.

---

## Architecture Decisions

| Decision            | Choice             | Rationale                                                                                                                                                       |
| ------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PTY Library**     | `@zenyr/bun-pty`   | Cross-platform support including Windows                                                                                                                        |
| **UI Location**     | Tool sidebar panel | New "Terminals" panel alongside existing tools                                                                                                                  |
| **Terminals/Card**  | One per card       | Simpler model, single terminal session per card                                                                                                                 |
| **Shell**           | Default shell      | Use `$SHELL` env var, fallback to `bash`                                                                                                                        |
| **Disconnect**      | Immediate destroy  | Terminal closes when all clients disconnect                                                                                                                     |
| **Transport**       | WebSocket          | Industry standard for interactive terminals, <1ms latency                                                                                                       |
| **State**           | Runtime only       | In-memory `Map<cardId, TerminalSession>`, no database table                                                                                                     |

---

## Feature Behavior

### When Terminals Are Available

A terminal is available for a card when **ALL** conditions are met:

1. Card is in **"In Progress"** or **"Review"** column
2. Card has an **active attempt** with a valid `worktreePath`
3. The worktree directory **exists** on disk

### Automatic Cleanup

Terminals are automatically destroyed when:

- Card moves to **Backlog** or **Done** (via `card.moved` event)
- Attempt ends/fails (via `attempt.status.changed` event)
- All WebSocket clients disconnect
- Server shuts down gracefully

---

## API Endpoints

### REST Endpoints

| Method | Endpoint                                | Description                        |
| ------ | --------------------------------------- | ---------------------------------- |
| GET    | `/api/v1/projects/:projectId/terminals` | List active terminals for project  |
| GET    | `/api/v1/projects/:projectId/terminals/eligible` | List cards eligible for terminals |
| GET    | `/api/v1/terminals/:cardId`             | Get terminal info                  |
| POST   | `/api/v1/terminals/:cardId/resize`      | Resize terminal                    |
| DELETE | `/api/v1/terminals/:cardId`             | Force close terminal               |

### WebSocket Endpoint

| Endpoint                          | Description                 |
| --------------------------------- | --------------------------- |
| `ws://.../api/v1/terminals/:cardId/ws` | Bidirectional terminal I/O |

### WebSocket Protocol

**Client → Server:**
```typescript
| { type: 'data', data: string }           // Terminal input
| { type: 'resize', cols: number, rows: number }  // Resize
```

**Server → Client:**
```typescript
| { type: 'data', data: string }           // Terminal output
| { type: 'exit', code: number }           // Process exit
| { type: 'error', message: string }       // Error
```

---

## File Structure

### Backend (NEW)

```
server/src/terminal/
├── terminal.service.ts     # TerminalService class
├── terminal.schemas.ts     # Zod schemas for validation
├── terminal.handlers.ts    # HTTP handlers
├── terminal.ws.ts          # WebSocket upgrade handler
├── routes.ts               # Route definitions
└── listeners.ts            # Event bus listeners

server/src/events/types/
└── terminal-events.ts      # Terminal event types

shared/src/types/
└── terminal.ts             # Shared TypeScript types
```

### Frontend (NEW)

```
client/src/components/Terminal/
├── Terminal.tsx            # xterm.js wrapper
├── TerminalPanel.tsx       # Single terminal panel
├── TerminalsToolWindow.tsx # Tool sidebar panel
├── useTerminal.ts          # WebSocket hook
└── index.ts                # Exports

client/src/api/
└── terminals.ts            # API client

client/src/pages/
└── TerminalsPage.tsx       # Route page
```

### Modified Files

**Backend:**
- `server/package.json` - add `@zenyr/bun-pty`
- `server/src/app.ts` - mount terminal routes
- `server/src/events/index.ts` - add TerminalEventMap
- `server/src/events/register.ts` - register terminal listeners
- `server/src/entry/dev.ts` - add WebSocket handling
- `shared/src/types/index.ts` - export terminal types

**Frontend:**
- `client/package.json` - add xterm dependencies
- `client/src/components/layout/AppSidebar.tsx` - add Terminals nav
- `client/src/App.tsx` - add route

---

## Dependencies

### Server
```bash
bun add @zenyr/bun-pty
```

### Client
```bash
bun add xterm @xterm/addon-fit @xterm/addon-web-links
```

---

## Implementation Phases

### Phase 1: Backend Infrastructure

1. Add `@zenyr/bun-pty` dependency
2. Create shared terminal types (`shared/src/types/terminal.ts`)
3. Create terminal event types (`server/src/events/types/terminal-events.ts`)
4. Update event index to include TerminalEventMap
5. Create terminal service (`server/src/terminal/terminal.service.ts`)
6. Create terminal schemas (`server/src/terminal/terminal.schemas.ts`)
7. Create terminal handlers (`server/src/terminal/terminal.handlers.ts`)
8. Create WebSocket handler (`server/src/terminal/terminal.ws.ts`)
9. Create terminal routes (`server/src/terminal/routes.ts`)
10. Create event listeners (`server/src/terminal/listeners.ts`)
11. Mount routes in app.ts
12. Register listeners in events/register.ts
13. Add WebSocket support to server entry

### Phase 2: Frontend

1. Add xterm dependencies
2. Create terminal API client (`client/src/api/terminals.ts`)
3. Create useTerminal hook (`client/src/components/Terminal/useTerminal.ts`)
4. Create Terminal component (`client/src/components/Terminal/Terminal.tsx`)
5. Create TerminalPanel component (`client/src/components/Terminal/TerminalPanel.tsx`)
6. Create TerminalsToolWindow (`client/src/components/Terminal/TerminalsToolWindow.tsx`)
7. Create index exports
8. Create TerminalsPage
9. Add route to App.tsx
10. Add navigation to AppSidebar

### Phase 3: Testing & Polish

1. Manual testing of terminal functionality
2. Test card move auto-cleanup
3. Test multi-client scenario
4. Test reconnection behavior

---

## Estimated Timeline

| Phase   | Task                   | Time       |
| ------- | ---------------------- | ---------- |
| Phase 1 | Backend infrastructure | ~6-8 hours |
| Phase 2 | Frontend components    | ~6-8 hours |
| Phase 3 | Testing & integration  | ~2-3 hours |
| **Total** |                      | **~2-3 days** |

---

## Event Flow

```
User clicks "Open Terminal" for card
         │
         ▼
WebSocket connects to /terminals/:cardId/ws
         │
         ▼
Server checks card eligibility
         │
         ├── Not eligible → Close with error code
         │
         ▼
Get or create TerminalSession
         │
         ▼
Add client to session.clients
         │
         ▼
PTY output → broadcast to all clients
         │
         ▼
Client input → write to PTY
         │
         ▼
On disconnect → remove client
         │
         ├── clients.size > 0 → keep session
         │
         ▼
clients.size === 0 → destroy session
```

---

## Cleanup Event Flow

```
card.moved event (to Backlog/Done)
         │
         ▼
Check if terminal session exists
         │
         ├── No → ignore
         │
         ▼
Check if new column is eligible
         │
         ├── Yes → keep session
         │
         ▼
No → destroySession(cardId, 'card_moved')
         │
         ▼
Close all WebSocket clients
         │
         ▼
Kill PTY process
         │
         ▼
Publish 'terminal.closed' event
```
