---
title: Ticket enhancement
---

# Ticket enhancement

## Overview

Ticket enhancement lets KanbanAI rewrite rough ticket drafts (title + description) using your configured agents before
you create or update a card. It is still an inline operation in the sense that no Attempts, branches, or commits are
started automatically; instead, the enhancement request is queued as a background job and the rewritten text is persisted
only when you explicitly accept it via the board UI.

The same inline infrastructure powers PR inline summaries/templates: both flows keep requests non-blocking, cache
results per project/branch, and let users close dialogs while the inline task runs, then rehydrate the suggestion when
they return.

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
- After the board records the new card, a toast pops up with "Ticket created" and clarifies that enhancement is running in the background so you stay focused on the board while the agents work.
- A temporary banner above the board columns also appears while one or more enhancements are pending, showing a spinner and the count of cards being enhanced so you know the system is processing without reopening each card manually.
- Once a suggestion arrives, the card displays a sparkles icon that opens the enhancement diff dialog (see below).

### Enhancing existing cards

- The **Card Inspector** (Details pane) and **Edit Ticket** dialog now surface an **Enhance in background** button near the
  description controls.
- Clicking the button saves the latest title/description first, then queues the enhancement job with those values.
- The same badge and icon behavior applies while the enhancement runs and when a suggestion becomes available.

### Reviewing suggestions

- When an enhancement job finishes, click the sparkles icon on the card to open the enhancement diff dialog. The dialog
  compares the persisted title/description on the left with the AI-enhanced copy on the right.
- The dialog header surfaces a subtle "AI suggestion ready" label and reminds you that the ticket already exists, so the suggestion is just a refinement to the saved draft.
- **Accept** automatically updates the card via `PATCH /boards/:boardId/cards/:cardId`, overriding the title/description
  with the suggestion and clearing the enhancement state.
- When the patch succeeds it also sets `isEnhanced = true`, which lets the board render the persistent "Enhanced" badge
  and highlight discussed in the board guide; clients can toggle that flag via the same endpoint if they want to clear or
  reapply the badge later.
- **Reject** dismisses the suggestion without mutating the card and keeps the enhancement badge cleared so you can rerun
  enhancement later.
- After either action you can trigger enhancement again to get a new suggestion.
- Enhancements still never create Attempts, branches, or commits; they only replace the persisted title/description when
  you accept a suggestion.

- From the board, Backlog cards also expose an **Enhance ticket…** action in their three-dots menu:
  - It opens the Edit Ticket dialog for that card and immediately queues the same background enhancement job using the current title and description.
  - You review and accept or reject suggestions via the sparkles icon and enhancement diff dialog described above.

## API surface

The UI and integrations continue to use the same enhancement endpoint, but now trigger it via the background workflow:

- `POST /projects/:projectId/tickets/enhance`
  - Request body:
    - `title` (string, required).
    - `description` (string, optional, defaults to empty when omitted).
    - `agent` (string, optional agent key override).
    - `profileId` (string, optional profile ID override).
    - `ticketType` (string, optional Conventional Commit style type: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`).
  - Successful response (`200 OK`):
    - `{ "ticket": { "title": "...", "description": "..." } }`
- Error handling:
  - Unknown or missing project → `404` problem response.
  - Unknown agent key or agent without ticket-enhancement support → `400` problem response.
  - Internal errors in the enhancement pipeline → `502` problem response with a generic "Failed to enhance ticket"
    message.
  - Invalid ticket type → `400` with a message like "Invalid ticket type: <value>" (the value is normalized to
    lowercase when valid).
- The endpoint remains a pure transformation:
  - It does not create, update, or persist cards and leaves that to the board APIs.
  - The board UI queues this request, watches the enhancement status, and applies the accepted suggestion via the normal
    card APIs.

## Enhancement state persistence

Enhancements are now persisted per-card so the UI can show badges and ready-state indicators even if you reload the
board or switch devices:

- `GET /projects/:projectId/enhancements`
  - Returns `{ "enhancements": { "<cardId>": { "status": "enhancing" | "ready", "suggestion?": { "title": string, "description?": string } } } }`.
  - The client polls this endpoint on board load and after state changes to hydrate each card's badge and sparkle icon.
- `PUT /projects/:projectId/cards/:cardId/enhancement`
  - Persists the current status (`"enhancing"` while the job is running, `"ready"` once the agent response arrives) and
    an optional `suggestion` payload derived from the enhancement result.
  - Called when the UI queues a background job and again when the suggestion is ready so other clients can pick up the
    same state.
- `DELETE /projects/:projectId/cards/:cardId/enhancement`
  - Clears the persisted entry when a suggestion is accepted, rejected, or abandoned so the card returns to its normal
    state.

The persisted state lets sessions share information about pending and ready suggestions without refetching every card.

## Agent pipeline

Under the hood, ticket enhancement is orchestrated by `agentEnhanceTicket` in the core layer, implemented as a generic
inline task with `kind = "ticketEnhance"`:

- Input options:
  - `projectId`, optional `boardId`.
  - `title`, `description`, optional `ticketType`.
  - Optional `agentKey`, optional `profileId`, optional `AbortSignal`.
- Behavior:
  - Loads the project and its settings (including `baseBranch`, `inlineAgent`, `inlineProfileId`).
  - Resolves an effective `boardId` from the provided value, the project board, or the project ID.
  - Chooses an agent:
    - Uses the explicit `agentKey` when provided (for advanced integrations).
    - Otherwise prefers the project's configured `inlineAgent`.
    - When no `inlineAgent` is configured, falls back to the project's `defaultAgent`, or `"DROID"` when none is set.
  - Validates that the agent exists and supports inline ticket enhancement, throwing errors for:
    - `Project not found`.
    - `Unknown agent: <KEY>`.
    - `Agent <KEY> does not support ticket enhancement`.
  - Constructs:
    - A `TicketEnhanceInput` containing project/board identifiers, repository path, base branch, title, description,
      optional ticket type, profile ID, and a cancellation signal. When provided, the type is echoed into the prompt so
      agents can suggest Conventional Commit–aligned titles.
    - An `InlineTaskContext` with project, repo, branch, optional ticket type, and agent/profile metadata.
  - Resolves an agent profile in this order:
    - Uses the explicit `profileId` when provided.
    - Otherwise, consults the per-inline-agent mapping for `InlineAgentId = "ticketEnhance"` (when configured) to pick a profile dedicated to ticket enhancement.
    - Otherwise, when using the project's `inlineAgent`, prefers the project's configured `inlineProfileId`.
    - Otherwise, when falling back to the default agent, prefers the project's `defaultProfileId` (if configured).
    - In all cases, when the referenced profile is missing or invalid, logs a warning and falls back to the agent's default profile so enhancement can still proceed.
  - For inline requests, prefers an agent's inline profile prompt (when configured) over the primary profile prompt:
    - If the resolved profile contains `inlineProfile`, it is used to tailor the ticket-enhancement prompt.
    - Otherwise, the primary profile's prompt (e.g. `appendPrompt`) is used as before.
  - Annotates the inline context with `profileSource: "inline" | "primary"` so telemetry can distinguish which prompt was used.
  - Invokes `runInlineTask({agentKey, kind: "ticketEnhance", input, profile, context, signal})`.
  - Returns the `TicketEnhanceResult` (rewritten title + description) to the caller.
  - Today, the following built-in agents implement inline ticket enhancement:
    - `CODEX` via the Codex SDK.
    - `DROID` via the Droid CLI.
    - `OPENCODE` via the `@opencode-ai/sdk` client, reusing the same `buildTicketEnhancePrompt`/`splitTicketMarkdown`
      contract and honoring `inlineProfile` as the primary prompt for inline flows.

## When to use ticket enhancement

- Turning terse titles into fuller tickets with acceptance criteria before starting an Attempt.
- Cleaning up imported GitHub issues or backlog items without touching the underlying repository.
- Giving non-technical stakeholders a simple "Improve this ticket" button while keeping full control over what actually
  gets saved.

## Custom prompts

Projects can override the default ticket enhancement prompt with a custom one via the **Custom Prompts** section in project settings. When a custom prompt is configured:

- Your custom prompt replaces the built-in system prompt as the base.
- The ticket context (title, description, type) is automatically appended to your custom prompt.
- Profile append prompts still apply on top of the custom prompt.

This allows you to tailor the enhancement behavior to your project's conventions while keeping the input context intact.

For implementation details on agents, profiles, and the enhancement contract, see `core/agents-and-profiles.md`.
