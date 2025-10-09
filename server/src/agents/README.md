# Agents Module

## Purpose

- Define the Agent interface and registry for command-based agents (Codex, Shell, etc.).
- Provide profile schema handling, profile CRUD, and agent-specific runners.
- Emit agent lifecycle events so the UI stays in sync with available agents and profiles.

## Data & Event Flow

1. **Registry (`registry.ts`)**
    - `registerAgent` stores agents and emits `agent.registered` whenever an agent is added.
    - `bindAgentEventBus` publishes the full registry once the event bus is available.
2. **Profiles (`core/agents/profiles`)**
    - Shared profile CRUD lives in the `core` package and is consumed by `projects/routes.ts`.
    - Create/update/delete operations emit `agent.profile.changed` (kind + profile metadata).
3. **Runners**
    - Agents implement `Agent.run` / `resume` (Codex via `CommandAgent`).
    - The attempts service calls into the agent and forwards JSONL output via `emit` which becomes attempt events.

## Key Entry Points

- `types.ts`: Agent interfaces & capabilities.
- `registry.ts`: registration + event integration.
- `codex/`, `shell/`, `echo/`: concrete agents.
- `core/agents/profiles.ts`: persistence helpers for agent profiles.

## Open Tasks

- Add UI feedback (toast/badge) reacting to `agent.profile.changed`/`agent.registered` events.
- Support dynamic agent loading/unloading at runtime (emit events accordingly).
- Provide tests covering registry event emission and profile CRUD flows.
