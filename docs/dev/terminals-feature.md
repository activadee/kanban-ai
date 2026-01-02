# Terminals Feature - Implementation Plan

> **Status**: Completed (PR #377)
> **Branch**: `dcb5dad`

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

| Method | Endpoint                                                      | Description                            |
| ------ | ------------------------------------------------------------- | -------------------------------------- |
| GET    | `/api/v1/projects/:projectId/terminals`                       | List active terminals for project      |
| GET    | `/api/v1/projects/:projectId/terminals/eligible`              | List cards eligible for terminals      |
| GET    | `/api/v1/terminals/:cardId`                                   | Get terminal info                      |
| POST   | `/api/v1/terminals/:cardId/resize`                            | Resize terminal                        |
| DELETE | `/api/v1/terminals/:cardId`                                   | Force close terminal                   |

### WebSocket Endpoint

| Endpoint                                              | Description                 |
| ------------------------------------------------------ | --------------------------- |
| `/terminals/:cardId/ws?projectId=:projectId`           | Bidirectional terminal I/O  |

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
- `server/src/start.ts` - WebSocket upgrade handler
- `server/src/events/index.ts` - add TerminalEventMap
- `server/src/events/register.ts` - register terminal listeners
- `server/src/events/types/terminal-events.ts` - terminal event types
- `shared/src/types/index.ts` - export terminal types

**Frontend:**
- `client/package.json` - add xterm, @xterm/addon-fit, @xterm/addon-web-links
- `client/src/components/layout/AppSidebar.tsx` - add Terminals nav
- `client/src/components/layout/MasterDetailLayout.tsx` - extend with renderItem, sidebarFooter, sidebarClassName props and generic type support
- `client/src/App.tsx` - add terminals route

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

## MasterDetailLayout Extensions

The `MasterDetailLayout` component was extended in this PR to support the Terminals feature:

### New Props

| Prop | Type | Description |
|------|------|-------------|
| `renderItem` | `(item: T, isActive: boolean, defaultRender: () => ReactNode) => ReactNode` | Custom item rendering with access to default render |
| `sidebarFooter` | `ReactNode` | Slot for Quick Launch section |
| `sidebarClassName` | `string` | Additional CSS classes for sidebar |
| `disabled` | `boolean` | Optional disabled state for MasterDetailItem |

### Generic Type Support

The component now supports generic typing:
```typescript
<MasterDetailLayout<TerminalItem>
  items={items}
  activeId={activeId}
  onSelect={handleSelect}
>
  {children}
</MasterDetailLayout<TerminalItem>>
```

Where `TerminalItem extends MasterDetailItem`.

---

## Terminals Page UI

The Terminals page features a modern design with:

- **PageHeader** with title, description, and "Live" badge indicator
- **Multi-terminal grid layout**: `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3`
- **Status badges**: Ready/Connected indicators with color-coded states
- **Maximize/restore actions** for terminal panels
- **Scanline overlay effect** for terminal aesthetic

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
WebSocket connects to /terminals/:cardId/ws?projectId=:projectId
          │
          ▼
Server checks card eligibility (worktree exists, attempt in valid state)
          │
          ├── Not eligible → Close with error code 4001
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
card.moved event (to Backlog/Done or attempt fails/stops)
          │
          ▼
Check if terminal session exists
          │
          ├── No → ignore
          │
          ▼
Check if new column is eligible / attempt status valid
          │
          ├── Yes → keep session
          │
          ▼
No → destroySession(cardId, 'card_moved' | 'attempt_ended')
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
