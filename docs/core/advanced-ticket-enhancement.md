---
title: Ticket enhancement
---

# Ticket enhancement

## Overview

Ticket enhancement lets KanbanAI rewrite rough ticket drafts (title + description) using your configured agents before
you create or update a card. It is still an inline operation in the sense that no Attempts, branches, or commits are
started automatically; instead, the enhancement request is queued as a background job and the rewritten text is persisted
only when you explicitly accept it via the board UI.

## UI behavior

### Creating tickets

- The **Create Ticket** dialog still collects a Title and optional Description/Dependencies.
- A new **Create & Enhance** button sits beside **Create Ticket**. It is enabled only when a non-empty title is present
  and disabled while the dialog is submitting.
- Clicking **Create & Enhance** creates the card via `POST /boards/:boardId/cards` and then immediately queues a ticket
  enhancement job for the newly created card. The board API response now includes the created `cardId` so the client can
  track which card the enhancement belongs to.
- While the enhancement job runs, the card shows an **Enhancing** badge and is temporarily marked as non-draggable to
  prevent accidental moves.
- Once a suggestion arrives, the card displays a sparkles icon that opens the enhancement diff dialog (see below).

### Enhancing existing cards

- The **Card Inspector** (Details pane) and **Edit Ticket** dialog now surface an **Enhance in background** button near the
  description controls.
- Clicking the button saves the latest title/description first, then queues the enhancement job with those values.
- The same badge and icon behavior applies while the enhancement runs and when a suggestion becomes available.

### Reviewing suggestions

- When an enhancement job finishes, click the sparkles icon on the card to open the enhancement diff dialog. The dialog
  compares the persisted title/description on the left with the AI-enhanced copy on the right.
- **Accept** automatically updates the card via `PATCH /boards/:boardId/cards/:cardId`, overriding the title/description
  with the suggestion and clearing the enhancement state.
- **Reject** dismisses the suggestion without mutating the card and keeps the enhancement badge cleared so you can rerun
  enhancement later.
- After either action you can trigger enhancement again to get a new suggestion.
- Enhancements still never create Attempts, branches, or commits; they only replace the persisted title/description when
  you accept a suggestion.

## API surface

The UI and integrations continue to use the same enhancement endpoint, but now trigger it via the background workflow:

- `POST /projects/:projectId/tickets/enhance`
  - Request body:
    - `title` (string, required).
    - `description` (string, optional, defaults to empty when omitted).
    - `agent` (string, optional agent key override).
    - `profileId` (string, optional profile ID override).
  - Successful response (`200 OK`):
    - `{ "ticket": { "title": "...", "description": "..." } }`
- Error handling:
  - Unknown or missing project → `404` problem response.
  - Unknown agent key or agent without ticket-enhancement support → `400` problem response.
  - Internal errors in the enhancement pipeline → `502` problem response with a generic `"Failed to enhance ticket"`
    message.
- The endpoint remains a pure transformation:
  - It does not create, update, or persist cards and leaves that to the board APIs.
  - The board UI queues this request, watches the enhancement status, and applies the accepted suggestion via the normal
    card APIs.

## Agent pipeline

Under the hood, ticket enhancement is orchestrated by `agentEnhanceTicket` in the core layer, implemented as a generic
inline task with `kind = "ticketEnhance"`:

- Input options:
  - `projectId`, optional `boardId`.
  - `title`, `description`.
  - Optional `agentKey`, optional `profileId`, optional `AbortSignal`.
- Behavior:
  - Loads the project and its settings (including `baseBranch`, `inlineAgent`, `inlineProfileId`).
  - Resolves an effective `boardId` from the provided value, the project board, or the project ID.
  - Chooses an agent:
    - Uses the explicit `agentKey` when provided (for advanced integrations).
    - Otherwise prefers the project’s configured `inlineAgent`.
    - When no `inlineAgent` is configured, falls back to the project’s `defaultAgent`, or `"DROID"` when none is set.
  - Validates that the agent exists and supports inline ticket enhancement, throwing errors for:
    - `Project not found`.
    - `Unknown agent: <KEY>`.
    - `Agent <KEY> does not support ticket enhancement`.
  - Constructs:
    - A `TicketEnhanceInput` containing project/board identifiers, repository path, base branch, title, description,
      profile ID, and a cancellation signal.
    - An `InlineTaskContext` with project, repo, branch, and agent/profile metadata.
  - Resolves an agent profile:
    - Uses the explicit `profileId` when provided.
    - Otherwise, when using the project’s `inlineAgent`, prefers the project’s configured `inlineProfileId`.
    - Otherwise, when falling back to the default agent, prefers the project’s `defaultProfileId` (if configured).
    - In all cases, falls back to the agent’s default profile when the configured profile is missing or invalid.
  - For inline requests, prefers an agent’s inline profile prompt (when configured) over the primary profile prompt:
    - If the resolved profile contains `inlineProfile`, it is used to tailor the ticket-enhancement prompt.
    - Otherwise, the primary profile’s prompt (e.g. `appendPrompt`) is used as before.
  - Annotates the inline context with `profileSource: "inline" | "primary"` so telemetry can distinguish which prompt was used.
  - Invokes `runInlineTask({agentKey, kind: "ticketEnhance", input, profile, context, signal})`.
  - Returns the `TicketEnhanceResult` (rewritten title + description) to the caller.

## When to use ticket enhancement

- Turning terse titles into fuller tickets with acceptance criteria before starting an Attempt.
- Cleaning up imported GitHub issues or backlog items without touching the underlying repository.
- Giving non-technical stakeholders a simple “Improve this ticket” button while keeping full control over what actually
  gets saved.

For implementation details on agents, profiles, and the enhancement contract, see `core/agents-and-profiles.md`.
