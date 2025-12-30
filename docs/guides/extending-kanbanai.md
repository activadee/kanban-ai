---
title: Extending KanbanAI
---

# Extending KanbanAI

This guide is for contributors who want to add new capabilities (agents, listeners, routes) without breaking the
existing layering between `core/` and `server/`.

## Architecture recap

- `core/`:
  - Business logic, abstract repository interfaces, and data access contracts.
  - Defines repository interfaces in `core/src/repos/interfaces.ts` and type definitions in `core/src/db/types.ts`.
  - No framework or runtime-specific code; database-agnostic.
- `server/`:
  - Hono app, Bun entrypoints, HTTP/WebSocket routes, adapters for core services.
  - Owns Drizzle schema definitions in `server/src/db/schema/` and implements concrete repositories in `server/src/repos/`.
  - Event bus wiring and module-level READMEs (`server/src/*/README.md`) describing each domain.
- `client/`:
  - React + Vite UI that talks to the API + WebSockets and uses shared types from `shared/`.

Most extensions involve:

- Adding/expanding a `core` service or listener.
- Adding routes/handlers in `server` that adapt HTTP/WebSockets to `core`.

## Adding a new agent

1. **Define the agent behavior** in `server/src/agents`:
   - Create a new folder (e.g. `server/src/agents/my-agent`) implementing the `Agent` interface from
     `server/src/agents/types.ts`.
   - Implement `run` and `resume`, streaming messages via the provided emitter.
2. **Register the agent** in `server/src/agents/registry.ts`:
   - Call `registerAgent('MY_AGENT_KEY', myAgentImpl)`.
   - The agent will be included in the registry pushed via `bindAgentEventBus`.
3. **Expose it to the UI (optional)**:
   - Ensure it is included in the `/agents` response so the client can render it.
   - Add any agent-specific profile schema/validation as needed.
4. **Wire profiles (optional)**:
   - If your agent needs custom profile schema, integrate with `core/agents/profiles` and validate configs before use.

For production, keep experimental agents (like Droid) unregistered or behind feature flags until stable.

## Adding a new event listener

1. **Define event types** in `core/src/events/types.ts` if you are introducing a new event kind.
2. **Publish events** from the relevant service:
   - Use the `AppEventBus` to `publish` domain events from core services.
3. **Register listeners**:
   - Add a new listener module (or extend an existing one) under `core/src/*/listeners.ts`.
   - Wire it into `registerEventListeners` in `server/src/events/register.ts`.
4. **Broadcast over WebSockets (optional)**:
   - If the event should reach clients in realtime, subscribe to it in `server/src/ws/listeners.ts` and map it to a
     WebSocket message defined in `shared/src/types/kanban.ts`.

## Adding a new HTTP route

1. **Add core functionality** (if needed):
   - Implement the underlying behavior in `core/` (service or helper).
2. **Create a router/handlers** in `server/src`:
   - Follow existing patterns in modules like `projects`, `attempts`, or `github`.
   - Keep Hono handlers thin: parse/validate input, call `core`, map results to JSON.
3. **Wire the router into `app.ts`**:
   - Route under `/api/v1` with a clear prefix (e.g. `/my-feature`).

## Where to read more

- `server/src/*/README.md` – domain-specific docs for:
  - attempts, github, tasks, projects, git, fs, ws, editor, settings, agents.
- `docs/core/ai-attempts.md` – how Attempts work end-to-end.
- `docs/core/git-integration.md` – git helpers and events.
- `docs/core/agents-and-profiles.md` – agents module and profiles.
