# Agents Module

## Purpose

- Define the Agent interface and registry for SDK- and command-based agents (Codex via SDK, OpenCode via SDK, Shell, etc.).
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
    - Agents implement `Agent.run` / `resume` (Codex now via the Codex SDK and `SdkAgent`).
    - The attempts service calls into the agent and forwards streamed events via `emit`, which becomes attempt events.
    - OpenCode's runner orchestrates streaming via `core/src/agents/opencode/core/agent.ts`:
        - `createSessionStream` ties the prompt to `opencode.event.subscribe`, filters every incoming event by `sessionID`/`sessionId`, watches for the `session.idle` signal, and fails the Attempt if the stream errors unexpectedly instead of silently logging.
        - `OpencodeGrouper` now emits each assistant text part as soon as it reports `time.end`, surfaces reasoning parts as `thinking` conversation items immediately when they complete, and publishes tool invocations only once when their status reaches `completed` or `error`, so the UI sees partial results even while the prompt is still running.

## Key Entry Points

- `types.ts`: Agent interfaces & capabilities.
- `registry.ts`: registration + event integration.
- `codex/`, `opencode/`, `shell/`, `echo/`: concrete agents.
- `core/agents/profiles.ts`: persistence helpers for agent profiles.

## Open Tasks

- Add UI feedback (toast/badge) reacting to `agent.profile.changed`/`agent.registered` events.
- Support dynamic agent loading/unloading at runtime (emit events accordingly).
- Provide tests covering registry event emission and profile CRUD flows.
---
title: Server: Agents module
---
