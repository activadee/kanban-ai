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
- Common settings include prompt customizations such as `appendPrompt` plus the new `inlineProfile` string used only for
  inline responses (ticket enhancement, future inline kinds). Inline tasks prefer a non-empty `inlineProfile` and
  otherwise fall back to the primary prompt so existing workflows keep working.
- Prompt fields are capped at 4,000 characters when creating or updating profiles (both project-scoped and global).
  Attempts to save longer prompts return an RFC 7807 error describing the offending field so callers can trim the text.

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
