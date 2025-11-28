# Agents & profiles

Last updated: 2025-11-28

## Agent registry

- The server exposes a pluggable **Agents** module responsible for:
  - Defining the `Agent` interface (capabilities, configuration).
  - Registering concrete agents (e.g. Codex via SDK and local CLI).
  - Emitting events so the UI can stay in sync with the available agents.
- Registry behavior:
  - `registerAgent` adds an agent and emits `agent.registered`.
  - `bindAgentEventBus` publishes the full registry when the event bus becomes available.
- In the current implementation:
  - The UI focuses on a Codex-based agent backed by the Codex SDK and local Codex CLI.
  - Experimental agents (e.g. Droid, OpenCode) exist in the codebase but are not exposed in the UI.

## Coding agents

KanbanAI’s agent registry is designed to host multiple **coding agents**. Today, the primary supported agent is Codex,
with additional agents under active development.

- **Codex**
  - Status: **Supported** (primary coding agent).
  - Implementation:
    - Backed by the Codex SDK and local Codex CLI.
    - Exposed in the UI (e.g. `/agents/CODEX`) and used for all production Attempts by default.
  - Capabilities:
    - Reads and writes files inside attempt worktrees.
    - Runs dev scripts and tools via the Attempts/runner pipeline.
    - Streams structured messages (steps, logs, diffs, suggestions) that power the Messages, Processes, and Logs views.
  - Configuration:
    - Tuned via agent profiles (model, temperature, tools/sandbox config) stored per project or globally.

- **Droid** (WIP)
  - Status: **Work in progress – not exposed in the UI, not supported for production use.**
  - Implementation:
    - Experimental agent module wired into the registry only in development builds.
    - Shares the same Attempt lifecycle and worktree model as Codex.
  - Intended goals:
    - Explore alternative planning/execution strategies and sandboxes.
    - Validate multi-agent orchestration patterns before promoting to a supported agent.

- **OpenCode** (WIP)
  - Status: **Work in progress – not exposed in the UI, not supported for production use.**
  - Implementation:
    - Experimental agent behind a feature flag / dev-only registration.
  - Intended goals:
    - Experiment with different model backends for code generation and refactoring.
    - Provide a fallback / alternative to Codex for future releases.

Until the WIP agents are promoted, **only Codex is considered stable**. New features and UI flows should continue to
target Codex as the default coding agent, with Droid/OpenCode reserved for internal testing and experimentation.

### Ticket enhancement interface

- Agents can optionally implement `enhance(input, profile)` alongside `run` / `resume`.
  - `input` is a `TicketEnhanceInput` containing project + board IDs, the canonical repository path, base branch, current
    card title/description, and the active `AbortSignal`.
  - The method returns a `TicketEnhanceResult` with the rewritten `title` and `description`.
  - Implementations must respect the provided signal so the UI can cancel enhancement requests.
- Typical use cases:
  - Enriching an imported GitHub issue before it becomes a KanbanAI card.
  - Rewriting terse card titles/descriptions with additional acceptance criteria before an Attempt starts.
- Helper utilities:
  - `core/agents/utils#splitTicketMarkdown(markdown, fallbackTitle, fallbackDescription)` extracts a leading H1 (`# `)
    from LLM output, making it easier for agents to return Markdown while still conforming to the required result shape.
  - `TicketEnhanceInput` / `TicketEnhanceResult` are exported from `core/agentTypes` (via `core/src/index.ts`) so custom
    agents can share the same types without reaching into private modules.

## Profiles: configuration for agents

- **Agent profiles** capture reusable configuration for a specific agent, such as:
  - Model and sampling parameters.
  - Tool/sandbox settings.
  - Any agent-specific options encoded as JSON.
- Profiles are stored in SQLite and managed through the `core/agents/profiles` service:
  - `listAgentProfiles(projectId)`
  - `getAgentProfile(projectId, id)`
  - `createAgentProfile(projectId, agent, name, config)`
  - `updateAgentProfile(projectId, id, patch)`
  - `deleteAgentProfile(projectId, id)`
- Each create/update/delete operation emits `agent.profile.changed` so caches and UI views can refresh.

### Global vs project profiles

- Profiles can be scoped:
  - **Per project** – associated with a specific project’s ID.
  - **Global** – workspace-wide entries (IDs beginning with `apg-`).
- The UI surfaces both:
  - The Dashboard and settings pages expose an Agents view (e.g. `/agents/CODEX`) where profiles can be created and
    edited.
  - When starting or following up on an Attempt, the “profile” selector shows relevant profiles from both scopes.

## How Attempts use agents and profiles

- When a new Attempt is started or resumed:
  - The Attempts service resolves which agent to use from:
    - The explicit agent selected in the UI, or
    - The project’s default agent setting.
  - If a profile ID is provided (or a project default profile is configured), the service:
    - Loads the profile.
    - Validates it against the agent’s schema.
    - Applies the configuration to the agent runner.
- Behavior on invalid/missing profiles:
  - If a referenced profile is missing or fails validation, KanbanAI logs a warning.
  - The Attempt falls back to the agent’s default profile so work can continue without manual cleanup.
- During execution:
  - Agents implement `run` and `resume` and stream structured messages back via callbacks.
  - The Attempts module translates these into `attempt.*` events and persists logs + conversation items, powering the
    Messages, Processes, and Logs tabs in the UI.
