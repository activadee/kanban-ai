---
title: Agent profiles
---

# Agent profiles

## Overview

Agent profiles let you capture reusable configuration for coding agents (e.g. Codex) and apply them consistently across
projects and Attempts.

## Storage and schema

- Profiles are stored in SQLite and managed by `core/agents/profiles`:
  - `listAgentProfiles(projectId)`
  - `getAgentProfile(projectId, id)`
  - `createAgentProfile(projectId, agent, name, config)`
  - `updateAgentProfile(projectId, id, patch)`
  - `deleteAgentProfile(projectId, id)`
- The `config` field is stored as JSON (`configJson`), whose shape is validated by the agent-specific schema at runtime.

## Profile configuration notes

- Each agent exposes its own schema (e.g. Codex, Droid, OpenCode) to validate the `config` JSON, so new fields or
  constraints must be registered there before the UI or CLI can persist them.
- Common settings include prompt customizations such as `appendPrompt` plus the new `inlineProfile` string:
  - For inline tasks (ticket enhancement, PR summaries), a non-empty `inlineProfile` is preferred over `appendPrompt`.
  - For the OpenCode agent, `inlineProfile` is also used as the primary system prompt for full attempts when set; when
    empty, it falls back to `appendPrompt`.
- OpenCode profiles can also configure their server targets:
  - `baseUrl` overrides the bundled `opencode serve` process and can also be supplied via `OPENCODE_BASE_URL`, switching the agent into remote mode.
  - `apiKey` is mirrored into `OPENCODE_API_KEY` when the SDK launches the local server, letting credentials stay in the profile even without manual environment setup.
- Prompt fields are capped at 4,000 characters when creating or updating profiles (both project-scoped and global).
  Attempts to save longer prompts return an RFC 7807 error describing the offending field so callers can trim the text.

### Reasoning effort levels

Codex and Droid agents both expose a reasoning-effort setting in their profiles:

- Codex: `modelReasoningEffort` – one of `minimal`, `low`, `medium`, `high`, or `xhigh`.
- Droid: `reasoningEffort` – one of `off`, `low`, `medium`, `high`, or `xhigh`.

Use higher levels for more complex or ambiguous tasks. In particular, `xhigh` enables the most intensive reasoning
mode and typically trades additional latency and token usage for deeper analysis.

Example Codex profile JSON using `xhigh`:

```json
{
  "agent": "CODEX",
  "name": "Deep reasoning profile",
  "config": {
    "model": "gpt-4.1",
    "modelReasoningEffort": "xhigh",
    "appendPrompt": "You are a senior engineer who explains tradeoffs clearly before making changes."
  }
}
```

## Scope and IDs

- Profiles can be:
  - **Per project** – scoped to a single project/board.
  - **Global** – workspace-wide entries (IDs beginning with `apg-`).
- ID conventions:
  - Project-scoped profiles use IDs like `ap-<uuid>`.
  - Global profiles use IDs starting with `apg-` so they’re easy to distinguish and reuse.

## How Attempts use profiles

- When starting or resuming an Attempt:
  - The Attempts service determines which agent to use:
    - Explicitly provided by the UI, or
    - From the project’s default agent setting.
  - It then resolves the profile:
    - From the explicit profile selection in the UI, or
    - From the project’s default profile (if configured).
  - The resolved profile is:
    - Loaded from the database.
    - Validated against the agent’s schema.
    - Applied to the agent runner if valid.
- On errors:
  - If the profile is missing or fails validation:
    - The service logs a warning.
    - The Attempt falls back to the agent’s default profile so work can continue.

## Events and UI updates

- Profile CRUD operations emit `agent.profile.changed` events that carry:
  - Profile kind (project/global).
  - Agent key.
  - Basic metadata (id, name, timestamps).
- WebSocket listeners forward these events so:
  - The Agents UI (e.g. `/agents/CODEX`) stays in sync without reloads.
  - Profile pickers in the Attempt start/follow-up dialogs show up-to-date options.

See also:

- `core/agents-and-profiles.md` for the broader agents module.
