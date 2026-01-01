# Agents Module

## Purpose

- Define the Agent interface and registry for SDK- and command-based agents (Codex via SDK, OpenCode via SDK, Droid via SDK, Shell, etc.).
- Provide profile schema handling, profile CRUD, and agent-specific runners.
- Emit agent lifecycle events so the UI stays in sync with available agents and profiles.

## Architecture

### Shared Abstractions (`core/src/agents/`)

The agent system uses shared abstractions to minimize code duplication:

```
core/src/agents/
├── sdk.ts                    # SdkAgent<P, I> base class with lifecycle hooks
├── command.ts                # CommandAgent<P> base class for CLI agents
├── types.ts                  # Agent interfaces, AgentContext, inline task types
├── utils.ts                  # Shared utilities (prompt building, markdown parsing)
├── profiles/
│   └── base.ts               # BaseProfileSchema (shared profile fields)
└── sdk/
    ├── context-factory.ts    # Factory for inline task contexts
    ├── executable.ts         # Executable discovery (locateExecutable)
    └── stream-grouper.ts     # Common stream grouping utilities
```

**Key shared components:**

- `BaseProfileSchema`: Zod schema with common fields (`appendPrompt`, `inlineProfile`, `debug`)
- `SdkAgent<P, I>`: Abstract base class implementing `Agent<P>` with:
  - Lifecycle hooks: `onRunStart(ctx, profile, mode)`, `onRunEnd(ctx, profile, mode)` where `mode` is `'run'` or `'resume'`
  - Default `inline()` dispatch to `enhance()` / `summarizePullRequest()`
  - Template methods: `detectInstallation()`, `createClient()`, `startSession()`, `resumeSession()`, `handleEvent()`
- `locateExecutable()`: Unified executable discovery with env vars and PATH fallback
- `createEnhanceContext()` / `createPrSummaryContext()`: Factory functions for inline task contexts

### Agent File Structure

Each SDK agent follows a modular file structure:

```
core/src/agents/{agent}/
├── core/
│   ├── agent.ts          # Main agent class (~300-340 lines)
│   ├── handlers.ts       # Event handlers
│   └── ...               # Agent-specific modules
├── profiles/
│   └── schema.ts         # Profile schema (extends BaseProfileSchema)
├── runtime/              # Runtime utilities (groupers, etc.)
└── protocol/             # Protocol types (if applicable)
```

### OpenCode Agent (`core/src/agents/opencode/`)

```
opencode/
├── core/
│   ├── agent.ts          # OpencodeImpl class (318 lines)
│   ├── handlers.ts       # Event handlers (message, tool, todo, error)
│   ├── streaming.ts      # createSessionStream() for SSE
│   ├── inline.ts         # enhance() and summarizePullRequest()
│   ├── server.ts         # OpencodeServerManager, port utilities
│   └── errors.ts         # Error handling utilities
├── profiles/
│   └── schema.ts         # OpencodeProfileSchema
├── runtime/
│   └── grouper.ts        # OpencodeGrouper for event batching
└── protocol/
    └── types.ts          # ShareToolContent, etc.
```

**Key features:**
- `OpencodeServerManager`: Manages local server instances by port
- `createSessionStream()`: Handles SSE subscription with idle timeout
- Event filtering by `sessionID` for multi-session environments

### Codex Agent (`core/src/agents/codex/`)

```
codex/
├── core/
│   ├── agent.ts          # CodexImpl class (337 lines)
│   ├── handlers.ts       # Event item handlers
│   └── logging.ts        # Debug utilities (redactSecrets, safeStringify)
├── profiles/
│   └── schema.ts         # CodexProfileSchema
└── runtime/              # (uses shared StreamGrouper)
```

**Key features:**
- Thread-based sessions via `@openai/codex-sdk`
- Sandbox modes: `read-only`, `workspace-write`, `danger-full-access`
- Image support via `saveImagesToTempFiles()`

### Droid Agent (`core/src/agents/droid/`)

```
droid/
├── core/
│   ├── agent.ts          # DroidImpl class (310 lines)
│   └── handlers.ts       # Event handlers
├── profiles/
│   └── schema.ts         # DroidProfileSchema
└── runtime/              # (uses shared StreamGrouper)
```

**Key features:**
- Thread-based sessions via `@activade/droid-sdk`
- Autonomy levels and reasoning effort configuration
- Image attachments support

## Data & Event Flow

1. **Registry (`registry.ts`)**
    - `registerAgent` stores agents and emits `agent.registered` whenever an agent is added.
    - `bindAgentEventBus` publishes the full registry once the event bus is available.
2. **Profiles (`core/agents/profiles`)**
    - Shared profile CRUD lives in the `core` package and is consumed by `projects/routes.ts`.
    - Create/update/delete operations emit `agent.profile.changed` (kind + profile metadata).
    - All profile schemas extend `BaseProfileSchema` for consistent field handling.
3. **Runners**
    - Agents implement `Agent.run` / `resume` via `SdkAgent` base class.
    - Lifecycle hooks (`onRunStart(ctx, profile, mode)`, `onRunEnd(ctx, profile, mode)`) handle grouper setup/cleanup. The `mode` parameter is `'run'` or `'resume'`.
    - The attempts service calls into the agent and forwards streamed events via `emit`.

## Key Entry Points

- `types.ts`: Agent interfaces & capabilities.
- `sdk.ts`: `SdkAgent<P, I>` base class with lifecycle hooks.
- `registry.ts`: Registration + event integration.
- `profiles/base.ts`: `BaseProfileSchema` and `getEffectiveInlinePrompt()`.
- `sdk/executable.ts`: `locateExecutable()` for CLI discovery.
- `sdk/context-factory.ts`: Inline task context factories.
- `codex/`, `opencode/`, `droid/`, `shell/`, `echo/`: Concrete agents.

## Implementing a New SDK Agent

1. Create profile schema extending `BaseProfileSchema`:
    ```typescript
    export const MyAgentProfileSchema = BaseProfileSchema.extend({
        // agent-specific fields
    })
    ```

2. Create agent class extending `SdkAgent<P, I>`:
    ```typescript
    class MyAgentImpl extends SdkAgent<MyProfile, MyInstallation> {
        key = 'MYAGENT' as const
        // Implement: detectInstallation, createClient, startSession,
        //            resumeSession, handleEvent
        // Optional: onRunStart(ctx, profile, mode), onRunEnd(ctx, profile, mode),
        //           enhance, summarizePullRequest
    }
    ```

3. Register in the agent registry.

## Open Tasks

- Add UI feedback (toast/badge) reacting to `agent.profile.changed`/`agent.registered` events.
- Support dynamic agent loading/unloading at runtime (emit events accordingly).
- Provide tests covering registry event emission and profile CRUD flows.
---
title: Server: Agents module
---
