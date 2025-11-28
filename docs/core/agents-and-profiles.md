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
  - Experimental agents (e.g. Droid, OpenCode) may exist in the codebase but are not exposed in the UI.

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

